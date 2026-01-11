from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import threading
from datetime import datetime
import yt_dlp
import logging

# ==================== SETUP ====================
app = Flask(__name__)
CORS(
    app, resources={r"/api/*": {"origins": "*"}}, expose_headers=["Content-Disposition"]
)

log = logging.getLogger("werkzeug")
log.setLevel(logging.ERROR)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_DIR = os.path.join(BASE_DIR, "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

download_progress = {}


# ==================== DOWNLOAD WORKER ====================
def download_mp3(video_url, download_id):
    try:

        def progress_hook(d):
            if d["status"] == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate", 0)
                downloaded = d.get("downloaded_bytes", 0)
                if total:
                    download_progress[download_id]["percentage"] = round(
                        downloaded / total * 100
                    )
                    download_progress[download_id]["status"] = "downloading"

            elif d["status"] == "finished":
                download_progress[download_id]["status"] = "converting"

        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title)s.%(ext)s"),
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
            "progress_hooks": [progress_hook],
            "quiet": True,
            "no_warnings": True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            title = info.get("title", "Unknown")

            filename = ydl.prepare_filename(info)
            output_file = filename.rsplit(".", 1)[0] + ".mp3"

        download_progress[download_id] = {
            "status": "complete",
            "percentage": 100,
            "file_path": output_file,
            "title": title,
        }

    except Exception as e:
        download_progress[download_id] = {
            "status": "error",
            "error": str(e),
        }


# ==================== API ROUTES ====================
@app.route("/api/download", methods=["POST"])
def start_download():
    data = request.json
    url = data.get("url")

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    download_id = datetime.now().strftime("%Y%m%d%H%M%S%f")
    download_progress[download_id] = {
        "status": "starting",
        "percentage": 0,
        "title": "Fetching info...",
    }

    threading.Thread(target=download_mp3, args=(url, download_id), daemon=True).start()
    return jsonify({"download_id": download_id})


@app.route("/api/progress/<download_id>")
def get_progress(download_id):
    if download_id not in download_progress:
        return jsonify({"error": "Invalid ID"}), 404
    return jsonify(download_progress[download_id])


@app.route("/api/file/<download_id>")
def get_file(download_id):
    data = download_progress.get(download_id)
    if not data or data["status"] != "complete":
        return jsonify({"error": "Not ready"}), 400

    path = data["file_path"]
    if not os.path.exists(path):
        return jsonify({"error": "File missing"}), 404

    return send_file(
        path,
        as_attachment=True,
        download_name=os.path.basename(path),
    )


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


# ==================== RUN ====================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
