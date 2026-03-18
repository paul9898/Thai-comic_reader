from __future__ import annotations

from collections import OrderedDict
import hashlib
import json
from pathlib import Path
import platform
import threading
from typing import Any

from fastapi import HTTPException
import numpy as np
from PIL import Image, ImageEnhance, ImageOps

from models import OcrBox, OcrRegion

BASE_DIR = Path(__file__).resolve().parent
OCR_CACHE_DIR = BASE_DIR / "storage" / "ocr-cache"


class OcrEngine:
    def __init__(self) -> None:
        self._reader = None
        self._load_error: str | None = None
        self._cache: OrderedDict[tuple[Any, ...], list[OcrBox]] = OrderedDict()
        self._cache_limit = 64
        self._warmup_started = False
        self._warmup_lock = threading.Lock()
        OCR_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _ensure_reader(self):
        if self._reader is not None:
            return self._reader
        if self._load_error:
            raise HTTPException(status_code=500, detail=self._load_error)

        try:
            import easyocr
            self._patch_easyocr_for_stability(easyocr)
        except ImportError as exc:
            self._load_error = "EasyOCR is not installed. Install backend dependencies first."
            raise HTTPException(status_code=500, detail=self._load_error) from exc

        try:
            self._reader = easyocr.Reader(["th"], gpu=False)
        except Exception as exc:  # pragma: no cover - model download/runtime specific
            message = str(exc)
            if "CERTIFICATE_VERIFY_FAILED" in message:
                self._load_error = (
                    "EasyOCR could not download its Thai model because SSL certificate verification failed. "
                    "Install the model cache manually or fix local Python certificate trust, then restart the backend."
                )
            else:
                self._load_error = f"EasyOCR failed to initialize: {message}"
            raise HTTPException(status_code=500, detail=self._load_error) from exc
        return self._reader

    def warm_up_async(self) -> None:
        with self._warmup_lock:
            if self._warmup_started:
                return
            self._warmup_started = True

        def runner() -> None:
            try:
                self._ensure_reader()
            except HTTPException:
                # Keep startup resilient; request-time paths will surface the error if OCR is used.
                return

        threading.Thread(target=runner, name="ocr-warmup", daemon=True).start()

    @staticmethod
    def _patch_easyocr_for_stability(easyocr_module) -> None:
        if getattr(easyocr_module, "_thai_comic_reader_patched", False):
            return

        if platform.system() != "Darwin":
            easyocr_module._thai_comic_reader_patched = True
            return

        from easyocr import recognition as recognition_module

        original_get_text = recognition_module.get_text

        def get_text_without_pin_memory(*args, **kwargs):
            character, imgH, imgW, recognizer, converter, image_list = args[:6]
            ignore_char = kwargs.get("ignore_char", "")
            decoder = kwargs.get("decoder", "greedy")
            beamWidth = kwargs.get("beamWidth", 5)
            batch_size = kwargs.get("batch_size", 1)
            contrast_ths = kwargs.get("contrast_ths", 0.1)
            adjust_contrast = kwargs.get("adjust_contrast", 0.5)
            filter_ths = kwargs.get("filter_ths", 0.003)
            device = kwargs.get("device", "cpu")

            batch_max_length = int(imgW / 10)
            char_group_idx = {}
            ignore_idx = []
            for char in ignore_char:
                try:
                    ignore_idx.append(character.index(char) + 1)
                except ValueError:
                    continue

            coord = [item[0] for item in image_list]
            img_list = [item[1] for item in image_list]
            align_collate_normal = recognition_module.AlignCollate(imgH=imgH, imgW=imgW, keep_ratio_with_pad=True)
            test_data = recognition_module.ListDataset(img_list)
            test_loader = recognition_module.torch.utils.data.DataLoader(
                test_data,
                batch_size=batch_size,
                shuffle=False,
                num_workers=0,
                collate_fn=align_collate_normal,
                pin_memory=False,
            )

            result1 = recognition_module.recognizer_predict(
                recognizer,
                converter,
                test_loader,
                batch_max_length,
                ignore_idx,
                char_group_idx,
                decoder,
                beamWidth,
                device=device,
            )

            low_confident_idx = [i for i, item in enumerate(result1) if item[1] < contrast_ths]
            result2 = []
            if low_confident_idx:
                img_list2 = [img_list[i] for i in low_confident_idx]
                align_collate_contrast = recognition_module.AlignCollate(
                    imgH=imgH,
                    imgW=imgW,
                    keep_ratio_with_pad=True,
                    adjust_contrast=adjust_contrast,
                )
                test_data = recognition_module.ListDataset(img_list2)
                test_loader = recognition_module.torch.utils.data.DataLoader(
                    test_data,
                    batch_size=batch_size,
                    shuffle=False,
                    num_workers=0,
                    collate_fn=align_collate_contrast,
                    pin_memory=False,
                )
                result2 = recognition_module.recognizer_predict(
                    recognizer,
                    converter,
                    test_loader,
                    batch_max_length,
                    ignore_idx,
                    char_group_idx,
                    decoder,
                    beamWidth,
                    device=device,
                )

            result = []
            for index, zipped in enumerate(zip(coord, result1)):
                box, pred1 = zipped
                if index in low_confident_idx:
                    pred2 = result2[low_confident_idx.index(index)]
                    result.append((box, pred1[0], pred1[1]) if pred1[1] > pred2[1] else (box, pred2[0], pred2[1]))
                else:
                    result.append((box, pred1[0], pred1[1]))

            return result

        recognition_module.get_text = get_text_without_pin_memory
        easyocr_module._thai_comic_reader_original_get_text = original_get_text
        easyocr_module._thai_comic_reader_patched = True

    @staticmethod
    def _polygon_to_bbox(points: list[list[float]]) -> list[int]:
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        return [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))]

    @staticmethod
    def _preprocess_image(image: Image.Image, fast_mode: bool = False) -> tuple[np.ndarray, float]:
        # Keep preprocessing lighter on already-large pages so OCR stays responsive.
        image = image.convert("L")
        image = ImageOps.autocontrast(image)
        image = ImageEnhance.Contrast(image).enhance(1.35 if fast_mode else 1.5)
        width, height = image.size
        longest_edge = max(width, height)
        scale = 1.0

        if fast_mode and longest_edge > 1900:
            scale = 1900 / longest_edge
        elif longest_edge < 1200:
            scale = 1.8
        elif longest_edge < 1800:
            scale = 1.35

        if scale != 1.0:
            image = image.resize((round(width * scale), round(height * scale)))

        return np.array(image), scale

    def _read_array(
        self,
        image_array: np.ndarray,
        scale: float,
        fast_mode: bool,
        offset_x: int = 0,
        offset_y: int = 0,
    ) -> list[OcrBox]:
        reader = self._ensure_reader()

        try:
            raw_results = reader.readtext(
                image_array,
                decoder="greedy",
                paragraph=False,
                batch_size=1,
                workers=0,
                contrast_ths=0.0 if fast_mode else 0.1,
                adjust_contrast=0.4 if fast_mode else 0.5,
                text_threshold=0.72 if fast_mode else 0.7,
                low_text=0.45 if fast_mode else 0.4,
                canvas_size=2048 if fast_mode else 2560,
            )
        except Exception as exc:  # pragma: no cover - OCR runtime specific
            raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc

        boxes: list[OcrBox] = []
        for index, result in enumerate(raw_results):
            polygon, text, confidence = result
            if confidence < 0.3 or not str(text).strip():
                continue
            boxes.append(
                OcrBox(
                    id=index,
                    text=str(text).strip(),
                    bbox=self._scale_bbox(self._polygon_to_bbox(polygon), scale, offset_x, offset_y),
                    confidence=float(confidence),
                )
            )
        return boxes

    @staticmethod
    def _scale_bbox(bbox: list[int], scale: float, offset_x: int, offset_y: int) -> list[int]:
        x_min, y_min, x_max, y_max = [round(value / scale) for value in bbox]
        return [x_min + offset_x, y_min + offset_y, x_max + offset_x, y_max + offset_y]

    @staticmethod
    def _disk_cache_path(cache_key: str) -> Path:
        return OCR_CACHE_DIR / f"{cache_key}.json"

    @staticmethod
    def _build_disk_cache_key(image_array: np.ndarray, fast_mode: bool) -> str:
        payload = image_array.tobytes()
        digest = hashlib.sha256()
        digest.update(b"fast" if fast_mode else b"quality")
        digest.update(str(image_array.shape).encode("utf-8"))
        digest.update(payload)
        return digest.hexdigest()

    def _read_disk_cache(self, cache_key: str) -> list[OcrBox] | None:
        cache_path = self._disk_cache_path(cache_key)
        if not cache_path.exists():
            return None

        try:
            payload = json.loads(cache_path.read_text(encoding="utf-8"))
            if not isinstance(payload, list):
                return None
            return [OcrBox(**item) for item in payload if isinstance(item, dict)]
        except Exception:
            return None

    def _write_disk_cache(self, cache_key: str, boxes: list[OcrBox]) -> None:
        cache_path = self._disk_cache_path(cache_key)
        try:
            cache_path.write_text(
                json.dumps([box.model_dump() for box in boxes], ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception:
            # Cache writes should never block OCR results from returning.
            return

    def _read_with_cache(
        self,
        cache_key: tuple[Any, ...],
        image: Image.Image,
        fast_mode: bool,
        offset_x: int = 0,
        offset_y: int = 0,
    ) -> list[OcrBox]:
        cached = self._cache.get(cache_key)
        if cached is not None:
            self._cache.move_to_end(cache_key)
            return cached

        processed_image, scale = self._preprocess_image(image, fast_mode=fast_mode)
        disk_cache_key = self._build_disk_cache_key(processed_image, fast_mode) if offset_x == 0 and offset_y == 0 else ""
        if disk_cache_key:
            disk_cached = self._read_disk_cache(disk_cache_key)
            if disk_cached is not None:
                self._cache[cache_key] = disk_cached
                self._cache.move_to_end(cache_key)
                if len(self._cache) > self._cache_limit:
                    self._cache.popitem(last=False)
                return disk_cached

        boxes = self._read_array(processed_image, scale, fast_mode=fast_mode, offset_x=offset_x, offset_y=offset_y)
        self._cache[cache_key] = boxes
        if len(self._cache) > self._cache_limit:
            self._cache.popitem(last=False)
        if disk_cache_key:
            self._write_disk_cache(disk_cache_key, boxes)
        return boxes

    def read(self, image_path: Path) -> list[OcrBox]:
        image = Image.open(image_path)
        stat = image_path.stat()
        cache_key = ("page", str(image_path), stat.st_mtime_ns, stat.st_size)
        return self._read_with_cache(cache_key, image, fast_mode=True)

    def read_region(self, image_path: Path, region: OcrRegion) -> list[OcrBox]:
        image = Image.open(image_path)
        image_width, image_height = image.size
        x_min = max(0, min(region.x, image_width - 1))
        y_min = max(0, min(region.y, image_height - 1))
        x_max = min(image_width, x_min + region.width)
        y_max = min(image_height, y_min + region.height)
        if x_max <= x_min or y_max <= y_min:
            raise HTTPException(status_code=400, detail="Selected OCR region is empty.")

        cropped = image.crop((x_min, y_min, x_max, y_max))
        stat = image_path.stat()
        cache_key = (
            "region",
            str(image_path),
            stat.st_mtime_ns,
            stat.st_size,
            x_min,
            y_min,
            x_max,
            y_max,
        )
        return self._read_with_cache(cache_key, cropped, fast_mode=False, offset_x=x_min, offset_y=y_min)


ocr_engine = OcrEngine()
