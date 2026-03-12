import argparse
import os
from pathlib import Path
from typing import Iterable, Tuple
import shutil
import subprocess

from PIL import Image, UnidentifiedImageError

SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff", ".gif", ".jfif", ".heic", ".heif"}

def iter_image_files(root: Path, recursive: bool):
    if recursive:
        for p in root.rglob("*"):
            if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS:
                yield p
    else:
        for p in root.iterdir():
            if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS:
                yield p

def resize_if_over_limit(im: Image.Image, max_side: int = 256) -> Image.Image:
    w, h = im.size
    if max(w, h) <= max_side:
        return im
    scale = max_side / float(max(w, h))
    new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
    # 为了兼容 Pillow 不同版本，优先使用 Image.Resampling.LANCZOS，回退到 Image.LANCZOS
    try:
        resample = Image.Resampling.LANCZOS
    except AttributeError:
        resample = Image.LANCZOS
    return im.resize(new_size, resample=resample)

def save_png_optimized(img: Image.Image, dst_path, do_palette=True, compress_level=9):
    im = img

    # 可选的 256 色量化（有损）
    if do_palette and im.mode in ("RGBA", "RGB"):
        if im.mode == "RGBA":
            # RGBA 图像只能使用 FASTOCTREE(2) 或 libimagequant(3) 进行量化
            im = im.quantize(colors=256, method=2, dither=Image.FLOYDSTEINBERG)
        else:
            im = im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)

    png_params = {
        "format": "PNG",
        "optimize": True,
        "compress_level": compress_level,
    }
    im.save(dst_path, **png_params)

def try_pngquant(png_path: Path, quality="60-90", speed=1, exe_path: str | None = None):
    """
    使用 pngquant 对 PNG 进行二次压缩（有损量化）。比对大小后更小则替换。
    返回: (ok, message)
    """
    bin_path = exe_path or shutil.which("pngquant")
    if bin_path is None:
        return False, "pngquant not found in PATH and no --pngquant-path provided"

    tmp_out = png_path.with_suffix(".tmp.png")
    cmd = [
        bin_path,
        f"--quality={quality}",
        f"--speed={speed}",
        "--force",
        "--output", str(tmp_out),
        str(png_path),
    ]
    try:
        res = subprocess.run(cmd, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode != 0:
            tmp_out.unlink(missing_ok=True)
            return False, f"pngquant failed with code {res.returncode}: {res.stderr.decode(errors='ignore')[:200]}"
        if tmp_out.exists() and tmp_out.stat().st_size < png_path.stat().st_size:
            tmp_out.replace(png_path)
        else:
            tmp_out.unlink(missing_ok=True)
        return True, "pngquant applied"
    except Exception as e:
        tmp_out.unlink(missing_ok=True)
        return False, f"pngquant error: {e}"

def convert_to_png(
    src: Path,
    dst_dir: Path,
    use_palette: bool = True,
    pngquant_on: bool = True,
    pngquant_quality: str = "60-90",
    pngquant_speed: int = 1,
    pngquant_path: str | None = r"C:\Users\TU\Desktop\dzl_tuyoo_project\pngquant\pngquant.exe",
) -> Tuple[bool, str, Path]:
    dst_path = dst_dir / (src.stem + ".png")
    try:
        with Image.open(src) as im:
            # 模式处理
            if im.mode in ("RGBA", "LA"):
                out = im.copy()
            else:
                try:
                    out = im.convert("RGBA")
                except Exception:
                    out = im.convert("RGB")

            # 先缩放到最长边不超过 256
            out = resize_if_over_limit(out, max_side=256)

            # 保存 PNG（可选调色板量化）
            save_png_optimized(out, dst_path, do_palette=use_palette, compress_level=9)

        # 可选 pngquant 二压
        if pngquant_on:
            ok_q, msg_q = try_pngquant(
                dst_path,
                quality=pngquant_quality,
                speed=pngquant_speed,
                exe_path=pngquant_path,
            )
            if not ok_q:
                return True, f"Converted (pngquant skipped: {msg_q}): {src} -> {dst_path}", dst_path
            else:
                return True, f"Converted + pngquant: {src} -> {dst_path}", dst_path

        return True, f"Converted: {src} -> {dst_path}", dst_path

    except UnidentifiedImageError:
        return False, f"Skip (unidentified image): {src}", dst_path
    except OSError as e:
        return False, f"Failed to convert {src}: {e}", dst_path
    except Exception as e:
        return False, f"Unexpected error for {src}: {e}", dst_path
    

def main():
    parser = argparse.ArgumentParser(description="Batch convert images to PNG (with optional compression).")
    parser.add_argument("-r", "--recursive", action="store_true", help="Recursively traverse subdirectories.")
    parser.add_argument("--delete-original", action="store_true", help="Delete original file after successful conversion.")
    parser.add_argument("--palette", action="store_true", help="Use 256-color palette quantization (lossy) before saving PNG.")
    parser.add_argument("--pngquant", action="store_true", help="Run pngquant after saving (lossy).")
    parser.add_argument("--quality", default="60-90", help="pngquant quality range, e.g., 60-90.")
    parser.add_argument("--speed", type=int, default=1, help="pngquant speed (1=slow/better, 10=fast/worse).")
    parser.add_argument("--pngquant-path", default=None, help="Path to pngquant executable if not in PATH.")
    args = parser.parse_args()

    # 交互式输入输入目录与输出目录
    in_str = input("请输入输入目录（图片所在目录）: ").strip()
    out_str = input("请输入输出目录（PNG 保存目录）: ").strip()
    if not in_str or not out_str:
        print("输入目录和输出目录不能为空。")
        return
    in_dir = Path(in_str).expanduser().resolve()
    out_dir = Path(out_str).expanduser().resolve()

    if not in_dir.exists() or not in_dir.is_dir():
        print(f"Input directory does not exist or is not a directory: {in_dir}")
        return

    out_dir.mkdir(parents=True, exist_ok=True)

    files = list(iter_image_files(in_dir, args.recursive))
    if not files:
        print("No supported image files found.")
        return

    success = 0
    failed = 0

    for src in files:
        # 保持相对结构
        if args.recursive:
            rel_parent = src.parent.relative_to(in_dir)
            target_dir = out_dir / rel_parent
        else:
            target_dir = out_dir

        ok, msg, out_path = convert_to_png(
            src,
            target_dir,
            use_palette=True,             # 或 False
            pngquant_on=True,             # 是否运行 pngquant
            pngquant_quality="60-90",     # 质量区间
            pngquant_speed=1,             # 速度
            pngquant_path=r"C:\Users\TU\Desktop\dzl_tuyoo_project\pngquant\pngquant.exe",  # 你的 pngquant 路径
        )
        
        print(msg)
        if ok:
            success += 1
            if args.delete_original:
                try:
                    os.remove(src)
                except Exception as e:
                    print(f"Warning: failed to delete original {src}: {e}")
        else:
            failed += 1

    print(f"\nDone. Success: {success}, Failed: {failed}, Total: {len(files)}")

if __name__ == "__main__":
    main()