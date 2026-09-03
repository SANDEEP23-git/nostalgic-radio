from flask import Flask, render_template, jsonify
import json
import os


app = Flask(__name__)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PLAYLIST_FILE = os.path.join(
    BASE_DIR,
    "data",
    "playlists.json"
)


def load_playlists():
    with open(
        PLAYLIST_FILE,
        "r",
        encoding="utf-8"
    ) as file:
        data = json.load(file)

    return data["modes"]


@app.route("/")
def home():
    playlists = load_playlists()

    return render_template(
        "index.html",
        playlists=playlists
    )


@app.route("/api/playlists")
def get_playlists():
    playlists = load_playlists()

    return jsonify(playlists)


if __name__ == "__main__":
    app.run(debug=True)