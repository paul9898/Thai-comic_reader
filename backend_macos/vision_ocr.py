from __future__ import annotations

from pathlib import Path

import Foundation
import Quartz
import Vision
from fastapi import HTTPException

from models import VisionOcrBox


def _image_size(image_path: Path) -> tuple[int, int]:
    url = Foundation.NSURL.fileURLWithPath_(str(image_path))
    source = Quartz.CGImageSourceCreateWithURL(url, None)
    if source is None:
        raise HTTPException(status_code=400, detail="Could not open image for Vision OCR.")

    properties = Quartz.CGImageSourceCopyPropertiesAtIndex(source, 0, None) or {}
    width = int(properties.get(Quartz.kCGImagePropertyPixelWidth, 0))
    height = int(properties.get(Quartz.kCGImagePropertyPixelHeight, 0))
    if not width or not height:
        raise HTTPException(status_code=400, detail="Could not determine image dimensions.")
    return width, height


def _normalized_bbox_to_pixels(bbox, image_width: int, image_height: int) -> list[int]:
    x_min = round(bbox.origin.x * image_width)
    y_min = round((1 - bbox.origin.y - bbox.size.height) * image_height)
    x_max = round((bbox.origin.x + bbox.size.width) * image_width)
    y_max = round((1 - bbox.origin.y) * image_height)
    return [x_min, y_min, x_max, y_max]


def recognize_text(image_path: Path) -> list[VisionOcrBox]:
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found.")

    image_width, image_height = _image_size(image_path)
    url = Foundation.NSURL.fileURLWithPath_(str(image_path))
    request_handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(True)
    request.setRecognitionLanguages_(["th-TH", "en-US"])

    success, error = request_handler.performRequests_error_([request], None)
    if not success:
        message = str(error) if error is not None else "Unknown Vision OCR failure."
        raise HTTPException(status_code=500, detail=f"Vision OCR failed: {message}")

    observations = request.results() or []
    boxes: list[VisionOcrBox] = []
    for index, observation in enumerate(observations):
        candidates = observation.topCandidates_(1)
        if not candidates:
            continue
        candidate = candidates[0]
        text = str(candidate.string()).strip()
        confidence = float(candidate.confidence())
        if not text:
            continue

        boxes.append(
            VisionOcrBox(
                id=index,
                text=text,
                bbox=_normalized_bbox_to_pixels(observation.boundingBox(), image_width, image_height),
                confidence=confidence,
            )
        )
    return boxes

