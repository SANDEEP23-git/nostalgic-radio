from flask import (
    Flask,
    render_template,
    jsonify,
    request,
    session
)

from dotenv import load_dotenv
from pymongo import MongoClient
from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from bson import ObjectId

import json
import os
import uuid

from datetime import (
    datetime,
    timezone,
    timedelta
)


# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()


# =========================================================
# FLASK APP
# =========================================================

app = Flask(__name__)

app.secret_key = os.getenv("SECRET_KEY")

if not app.secret_key:
    raise RuntimeError(
        "SECRET_KEY is missing from .env"
    )


# =========================================================
# SESSION CONFIGURATION
# =========================================================

# Login session will remain valid for 30 days
app.permanent_session_lifetime = timedelta(
    days=30
)

# Security settings for session cookie
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


# =========================================================
# MONGODB CONFIG
# =========================================================

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB")


if not MONGODB_URI:
    raise RuntimeError(
        "MONGODB_URI is missing from .env"
    )


if not MONGODB_DB:
    raise RuntimeError(
        "MONGODB_DB is missing from .env"
    )


# =========================================================
# MONGODB CONNECTION
# =========================================================

try:
    import certifi
    ca_cert = certifi.where()
except Exception:
    ca_cert = None

mongo_client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=30000,
    connectTimeoutMS=30000,
    tlsCAFile=ca_cert
)

# Test connection
try:
    mongo_client.admin.command("ping")
    print("[OK] MongoDB connected successfully!")
    print(f"[DB] Database: {MONGODB_DB}")
except Exception as e:
    print(f"[ERROR] Failed to connect to MongoDB Atlas: {e}")
    raise e

# Select database
db = mongo_client[MONGODB_DB]


# =========================================================
# COLLECTIONS
# =========================================================

users_collection = db["users"]

wishlists_collection = db["wishlists"]

memories_collection = db["memories"]

listening_history_collection = db["listening_history"]

presence_collection = db["presence"]


# =========================================================
# DATABASE INDEXES
# =========================================================

# One email = one account
users_collection.create_index(
    "email",
    unique=True
)

# One username = one account
users_collection.create_index(
    "username",
    unique=True
)

# One song can exist only once
# in one user's wishlist
wishlists_collection.create_index(
    [
        ("user_id", 1),
        ("video_id", 1)
    ],
    unique=True
)

# One custom memory per song per user
memories_collection.create_index(
    [
        ("user_id", 1),
        ("video_id", 1)
    ],
    unique=True
)

# Listening history
# Every song play is a separate record
listening_history_collection.create_index(
    [
        ("user_id", 1),
        ("played_at", -1)
    ]
)

print("[OK] MongoDB connected successfully!")

print(
    f"[DB] Database: {MONGODB_DB}"
)


# =========================================================
# PROJECT PATHS
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

PLAYLIST_FILE = os.path.join(
    BASE_DIR,
    "data",
    "playlists.json"
)


# =========================================================
# PLAYLIST LOADER
# =========================================================

def load_playlists():

    with open(
        PLAYLIST_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        data = json.load(file)

    return data["modes"]


# =========================================================
# HELPER — CURRENT USER
# =========================================================

def get_current_user():

    user_id = session.get(
        "user_id"
    )

    if not user_id:
        return None

    try:

        user = users_collection.find_one(
            {
                "_id": ObjectId(user_id)
            }
        )

        return user

    except Exception:

        return None


def serialize_user(user):
    if not user:
        return None
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "username": user.get("username", ""),
        "favorite_era": user.get("favorite_era", "90s-era")
    }


# =========================================================
# HELPER — REQUIRE LOGIN
# =========================================================

def require_login():

    user = get_current_user()

    if not user:

        return None, (
            jsonify(
                {
                    "success": False,
                    "message": "Login required"
                }
            ),
            401
        )

    return user, None


# =========================================================
# HOME
# =========================================================

@app.route("/")
def home():

    playlists = load_playlists()
    user = get_current_user()
    user_data = serialize_user(user)

    return render_template(
        "index.html",
        playlists=playlists,
        open_modal="",
        current_user_json=json.dumps(user_data) if user_data else "null",
        is_authenticated=bool(user)
    )


# =========================================================
# LOGIN PAGE
# =========================================================

@app.route("/login")
def login_page():

    playlists = load_playlists()
    user = get_current_user()
    user_data = serialize_user(user)

    return render_template(
        "index.html",
        playlists=playlists,
        open_modal="login",
        current_user_json=json.dumps(user_data) if user_data else "null",
        is_authenticated=bool(user)
    )


# =========================================================
# SIGNUP PAGE
# =========================================================

@app.route("/signup")
def signup_page():

    playlists = load_playlists()
    user = get_current_user()
    user_data = serialize_user(user)

    return render_template(
        "index.html",
        playlists=playlists,
        open_modal="signup",
        current_user_json=json.dumps(user_data) if user_data else "null",
        is_authenticated=bool(user)
    )


# =========================================================
# WISHLIST PAGE
# =========================================================

@app.route("/wishlist")
def wishlist_page():

    playlists = load_playlists()
    user = get_current_user()
    user_data = serialize_user(user)

    return render_template(
        "index.html",
        playlists=playlists,
        open_modal="wishlist" if user else "login",
        current_user_json=json.dumps(user_data) if user_data else "null",
        is_authenticated=bool(user)
    )


# =========================================================
# PLAYLIST API
# =========================================================

@app.route("/api/playlists")
def get_playlists():

    playlists = load_playlists()

    return jsonify(playlists)


# =========================================================
# =========================================================
# AUTHENTICATION SYSTEM
# =========================================================
# =========================================================


# =========================================================
# CREATE USERNAME
# =========================================================

def create_username(name, email):

    # First try name
    base = "".join(
        char.lower()
        if char.isalnum()
        else "_"
        for char in name.strip()
    )

    base = "_".join(
        part
        for part in base.split("_")
        if part
    )

    # If name is empty
    if not base:

        base = email.split("@")[0].lower()

    username = base

    counter = 1

    while users_collection.find_one(
        {
            "username": username
        }
    ):

        username = (
            f"{base}_{counter}"
        )

        counter += 1

    return username


# =========================================================
# SIGNUP
# =========================================================

@app.route(
    "/api/auth/signup",
    methods=["POST"]
)
def signup():

    data = request.get_json(
        silent=True
    ) or {}

    name = str(
        data.get("name", "")
    ).strip()

    email = str(
        data.get("email", "")
    ).strip().lower()

    password = str(
        data.get("password", "")
    )

    favorite_era = str(
        data.get(
            "favorite_era",
            "90s-era"
        )
    ).strip()


    # -----------------------------------------
    # VALIDATION
    # -----------------------------------------

    if not name:

        return jsonify(
            {
                "success": False,
                "message": "Name is required"
            }
        ), 400


    if not email:

        return jsonify(
            {
                "success": False,
                "message": "Email is required"
            }
        ), 400


    if len(password) < 4:

        return jsonify(
            {
                "success": False,
                "message":
                    "Password must be at least 4 characters"
            }
        ), 400


    # -----------------------------------------
    # CHECK EXISTING EMAIL
    # -----------------------------------------

    existing_user = (
        users_collection.find_one(
            {
                "email": email
            }
        )
    )

    if existing_user:

        return jsonify(
            {
                "success": False,
                "message":
                    "An account with this email already exists"
            }
        ), 409


    # -----------------------------------------
    # CREATE USERNAME
    # -----------------------------------------

    username = create_username(
        name,
        email
    )


    # -----------------------------------------
    # HASH PASSWORD
    # -----------------------------------------

    password_hash = (
        generate_password_hash(
            password
        )
    )


    # -----------------------------------------
    # CREATE USER DOCUMENT
    # -----------------------------------------

    user_document = {

        "name": name,

        "email": email,

        "username": username,

        "password_hash": password_hash,

        "favorite_era": favorite_era,

        "created_at":
            datetime.now(timezone.utc)
    }


    # -----------------------------------------
    # INSERT USER
    # -----------------------------------------

    try:

        result = (
            users_collection.insert_one(
                user_document
            )
        )

    except Exception as error:

        print(
            "Signup error:",
            error
        )

        return jsonify(
            {
                "success": False,
                "message":
                    "Could not create account"
            }
        ), 500


    # IMPORTANT:
    # DO NOT CREATE SESSION HERE.
    #
    # Signup only creates the account.
    # User must manually login afterwards.

    return jsonify(
        {
            "success": True,

            "message":
                "Account created successfully! Please sign in with your credentials.",

            "user": {
                "id":
                    str(result.inserted_id),

                "name":
                    name,

                "email":
                    email,

                "username":
                    username,

                "favorite_era":
                    favorite_era
            }
        }
    ), 201


# =========================================================
# LOGIN
# =========================================================

@app.route(
    "/api/auth/login",
    methods=["POST"]
)
def login():

    data = request.get_json(
        silent=True
    ) or {}

    identifier = str(
        data.get(
            "identifier",
            ""
        )
    ).strip().lower()

    password = str(
        data.get(
            "password",
            ""
        )
    )


    if not identifier or not password:

        return jsonify(
            {
                "success": False,
                "message":
                    "Username/email and password are required"
            }
        ), 400


    # -----------------------------------------
    # FIND USER
    # -----------------------------------------

    user = users_collection.find_one(
        {
            "$or": [
                {
                    "email": identifier
                },
                {
                    "username": identifier
                }
            ]
        }
    )


    if not user:

        return jsonify(
            {
                "success": False,
                "message":
                    "Invalid username/email or password"
            }
        ), 401


    # -----------------------------------------
    # VERIFY PASSWORD
    # -----------------------------------------

    password_valid = (
        check_password_hash(
            user["password_hash"],
            password
        )
    )


    if not password_valid:

        return jsonify(
            {
                "success": False,
                "message":
                    "Invalid username/email or password"
            }
        ), 401


    # -----------------------------------------
    # CREATE LOGIN SESSION
    # -----------------------------------------

    session.clear()

    # IMPORTANT:
    # Makes the Flask session persistent
    # instead of disappearing after browser close.
    session.permanent = True

    session["user_id"] = str(
        user["_id"]
    )


    return jsonify(
        {
            "success": True,

            "message":
                "Login successful",

            "user": {
                "id":
                    str(user["_id"]),

                "name":
                    user.get(
                        "name",
                        ""
                    ),

                "email":
                    user.get(
                        "email",
                        ""
                    ),

                "username":
                    user.get(
                        "username",
                        ""
                    ),

                "favorite_era":
                    user.get(
                        "favorite_era",
                        "90s-era"
                    )
            }
        }
    )


# =========================================================
# FORGOT / RESET PASSWORD
# =========================================================

@app.route(
    "/api/auth/reset-password",
    methods=["POST"]
)
def reset_password():

    data = request.get_json(
        silent=True
    ) or {}

    identifier = str(
        data.get("identifier", "")
    ).strip().lower()

    new_password = str(
        data.get("new_password", "")
    )

    confirm_password = str(
        data.get("confirm_password", "")
    )

    if not identifier:
        return jsonify(
            {
                "success": False,
                "message": "Username or email is required"
            }
        ), 400

    if not new_password:
        return jsonify(
            {
                "success": False,
                "message": "New password is required"
            }
        ), 400

    if len(new_password) < 4:
        return jsonify(
            {
                "success": False,
                "message": "Password must be at least 4 characters long"
            }
        ), 400

    if confirm_password and new_password != confirm_password:
        return jsonify(
            {
                "success": False,
                "message": "Passwords do not match"
            }
        ), 400

    # Find account by email or username
    user = users_collection.find_one(
        {
            "$or": [
                {
                    "email": identifier
                },
                {
                    "username": identifier
                }
            ]
        }
    )

    if not user:
        return jsonify(
            {
                "success": False,
                "message": "No account found with this username or email"
            }
        ), 404

    # Hash new password
    new_password_hash = generate_password_hash(new_password)

    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": new_password_hash,
                "password_updated_at": datetime.now(timezone.utc)
            }
        }
    )

    return jsonify(
        {
            "success": True,
            "message": "Password updated successfully! Please sign in with your new password.",
            "identifier": user.get("username") or user.get("email")
        }
    ), 200


# =========================================================
# CURRENT LOGGED-IN USER
# =========================================================

@app.route(
    "/api/auth/me"
)
def current_user():

    user = get_current_user()


    if not user:

        return jsonify(
            {
                "success": True,

                "logged_in": False,

                "user": None
            }
        )


    return jsonify(
        {
            "success": True,

            "logged_in": True,

            "user": {
                "id":
                    str(user["_id"]),

                "name":
                    user.get(
                        "name",
                        ""
                    ),

                "email":
                    user.get(
                        "email",
                        ""
                    ),

                "username":
                    user.get(
                        "username",
                        ""
                    ),

                "favorite_era":
                    user.get(
                        "favorite_era",
                        "90s-era"
                    )
            }
        }
    )


# =========================================================
# LOGOUT
# =========================================================

@app.route(
    "/api/auth/logout",
    methods=["POST"]
)
def logout():

    session.clear()

    return jsonify(
        {
            "success": True,

            "message":
                "Logged out successfully"
        }
    )


# =========================================================
# =========================================================
# USER-SPECIFIC WISHLIST
# =========================================================
# =========================================================


# =========================================================
# GET MY WISHLIST
# =========================================================

@app.route(
    "/api/wishlist",
    methods=["GET"]
)
def get_wishlist():

    user, error = require_login()

    if error:
        return error


    user_id = str(
        user["_id"]
    )


    wishlist = list(
        wishlists_collection.find(
            {
                "user_id": user_id
            }
        ).sort(
            "liked_at",
            -1
        )
    )


    for item in wishlist:

        item["_id"] = str(
            item["_id"]
        )


    return jsonify(
        {
            "success": True,

            "wishlist": wishlist
        }
    )


# =========================================================
# ADD SONG TO MY WISHLIST
# =========================================================

@app.route(
    "/api/wishlist",
    methods=["POST"]
)
def add_to_wishlist():

    user, error = require_login()

    if error:
        return error


    data = request.get_json(
        silent=True
    ) or {}


    video_id = str(
        data.get(
            "video_id",
            ""
        )
    ).strip()


    if not video_id:

        return jsonify(
            {
                "success": False,
                "message":
                    "video_id is required"
            }
        ), 400


    user_id = str(
        user["_id"]
    )


    wishlist_document = {

        "user_id":
            user_id,

        "video_id":
            video_id,

        "custom_title":
            str(
                data.get(
                    "custom_title",
                    ""
                )
            ).strip(),

        "original_title":
            str(
                data.get(
                    "original_title",
                    ""
                )
            ).strip(),

        "artist":
            str(
                data.get(
                    "artist",
                    ""
                )
            ).strip(),

        "thumbnail":
            str(
                data.get(
                    "thumbnail",
                    ""
                )
            ).strip(),

        "era":
            str(
                data.get(
                    "era",
                    ""
                )
            ).strip(),

        "liked_at":
            datetime.now(
                timezone.utc
            )
    }


    # -----------------------------------------
    # DUPLICATE CHECK
    # -----------------------------------------

    existing = (
        wishlists_collection.find_one(
            {
                "user_id":
                    user_id,

                "video_id":
                    video_id
            }
        )
    )


    if existing:

        return jsonify(
            {
                "success": True,

                "already_exists": True,

                "message":
                    "Song is already in your wishlist"
            }
        )


    # -----------------------------------------
    # INSERT
    # -----------------------------------------

    try:

        result = (
            wishlists_collection.insert_one(
                wishlist_document
            )
        )

    except Exception as error:

        print(
            "Wishlist insert error:",
            error
        )

        return jsonify(
            {
                "success": False,

                "message":
                    "Could not save song"
            }
        ), 500


    return jsonify(
        {
            "success": True,

            "message":
                "Song added to your wishlist",

            "id":
                str(result.inserted_id)
        }
    )


# =========================================================
# REMOVE SONG FROM MY WISHLIST
# =========================================================

@app.route(
    "/api/wishlist/<video_id>",
    methods=["DELETE"]
)
def remove_from_wishlist(
    video_id
):

    user, error = require_login()

    if error:
        return error


    user_id = str(
        user["_id"]
    )


    result = (
        wishlists_collection.delete_one(
            {
                "user_id":
                    user_id,

                "video_id":
                    video_id
            }
        )
    )


    return jsonify(
        {
            "success": True,

            "removed":
                result.deleted_count > 0
        }
    )


# =========================================================
# CHECK WHETHER SONG IS LIKED
# =========================================================

@app.route(
    "/api/wishlist/check/<video_id>"
)
def check_wishlist(
    video_id
):

    user, error = require_login()

    if error:
        return error


    user_id = str(
        user["_id"]
    )


    exists = (
        wishlists_collection.find_one(
            {
                "user_id":
                    user_id,

                "video_id":
                    video_id
            }
        )
        is not None
    )


    return jsonify(
        {
            "success": True,

            "liked":
                exists
        }
    )


# =========================================================
# =========================================================
# USER-SPECIFIC MEMORIES
# =========================================================
# =========================================================


# =========================================================
# GET MY MEMORIES
# =========================================================

@app.route(
    "/api/memories",
    methods=["GET"]
)
def get_memories():

    user, error = require_login()

    if error:
        return error


    user_id = str(
        user["_id"]
    )


    memories = list(
        memories_collection.find(
            {
                "user_id":
                    user_id
            }
        ).sort(
            "updated_at",
            -1
        )
    )


    for memory in memories:

        memory["_id"] = str(
            memory["_id"]
        )


    return jsonify(
        {
            "success": True,

            "memories":
                memories
        }
    )


# =========================================================
# SAVE / UPDATE MY MEMORY
# =========================================================

@app.route(
    "/api/memories",
    methods=["POST"]
)
def save_memory():

    user, error = require_login()

    if error:
        return error


    data = request.get_json(
        silent=True
    ) or {}


    video_id = str(
        data.get(
            "video_id",
            ""
        )
    ).strip()

    custom_title = str(
        data.get(
            "custom_title",
            ""
        )
    ).strip()


    if not video_id:

        return jsonify(
            {
                "success": False,

                "message":
                    "video_id is required"
            }
        ), 400


    if not custom_title:

        return jsonify(
            {
                "success": False,

                "message":
                    "custom_title is required"
            }
        ), 400


    user_id = str(
        user["_id"]
    )


    now = datetime.now(
        timezone.utc
    )


    memory_document = {

        "user_id":
            user_id,

        "video_id":
            video_id,

        "custom_title":
            custom_title,

        "original_title":
            str(
                data.get(
                    "original_title",
                    ""
                )
            ).strip(),

        "artist":
            str(
                data.get(
                    "artist",
                    ""
                )
            ).strip(),

        "thumbnail":
            str(
                data.get(
                    "thumbnail",
                    ""
                )
            ).strip(),

        "era":
            str(
                data.get(
                    "era",
                    ""
                )
            ).strip(),

        "updated_at":
            now
    }


    # -----------------------------------------
    # UPSERT
    # -----------------------------------------

    memories_collection.update_one(

        {
            "user_id":
                user_id,

            "video_id":
                video_id
        },

        {
            "$set":
                memory_document,

            "$setOnInsert": {
                "created_at":
                    now
            }
        },

        upsert=True
    )


    return jsonify(
        {
            "success": True,

            "message":
                "Memory saved successfully"
        }
    )


# =========================================================
# DELETE MY MEMORY
# =========================================================

@app.route(
    "/api/memories/<video_id>",
    methods=["DELETE"]
)
def delete_memory(
    video_id
):

    user, error = require_login()

    if error:
        return error


    user_id = str(
        user["_id"]
    )


    result = (
        memories_collection.delete_one(
            {
                "user_id":
                    user_id,

                "video_id":
                    video_id
            }
        )
    )


    return jsonify(
        {
            "success": True,

            "deleted":
                result.deleted_count > 0
        }
    )

# =========================================================
# LISTENING HISTORY
# =========================================================

@app.route(
    "/api/listening-history",
    methods=["POST"]
)
def add_listening_history():

    user, error = require_login()

    if error:
        return error

    data = request.get_json(
        silent=True
    ) or {}

    video_id = str(
        data.get("video_id", "")
    ).strip()

    if not video_id:
        return jsonify({
            "success": False,
            "message": "video_id is required"
        }), 400

    user_id = str(
        user["_id"]
    )

    history_document = {
        "user_id": user_id,
        "video_id": video_id,
        "title": str(
            data.get("title", "")
        ).strip(),
        "artist": str(
            data.get("artist", "")
        ).strip(),
        "thumbnail": str(
            data.get("thumbnail", "")
        ).strip(),
        "era": str(
            data.get("era", "")
        ).strip(),
        "played_at": datetime.now(
            timezone.utc
        )
    }

    listening_history_collection.insert_one(
        history_document
    )

    return jsonify({
        "success": True,
        "message": "Listening history saved"
    })


@app.route(
    "/api/listening-history",
    methods=["GET"]
)
def get_listening_history():

    user, error = require_login()

    if error:
        return error

    user_id = str(
        user["_id"]
    )

    history = list(
        listening_history_collection.find(
            {
                "user_id": user_id
            }
        )
        .sort(
            "played_at",
            -1
        )
        .limit(500)
    )

    for item in history:
        item["_id"] = str(
            item["_id"]
        )

    return jsonify({
        "success": True,
        "history": history
    })


# =========================================================
# =========================================================
# ONLINE PRESENCE
# =========================================================
# =========================================================

@app.route(
    "/api/presence/heartbeat",
    methods=["POST"]
)
def presence_heartbeat():

    # -----------------------------------------
    # GET VISITOR ID
    # -----------------------------------------

    visitor_id = request.cookies.get(
        "visitor_id"
    )


    # -----------------------------------------
    # CREATE NEW VISITOR ID
    # -----------------------------------------

    if not visitor_id:

        visitor_id = str(
            uuid.uuid4()
        )


    # -----------------------------------------
    # CURRENT UTC TIME
    # -----------------------------------------

    now = datetime.now(
        timezone.utc
    )


    # -----------------------------------------
    # CURRENT USER
    # -----------------------------------------

    user = get_current_user()

    user_id = None

    if user:

        user_id = str(
            user["_id"]
        )


    # -----------------------------------------
    # UPDATE PRESENCE
    # -----------------------------------------

    presence_collection.update_one(

        {
            "visitor_id":
                visitor_id
        },

        {
            "$set": {

                "last_seen":
                    now,

                "user_id":
                    user_id
            }
        },

        upsert=True
    )


    # -----------------------------------------
    # ONLINE CUTOFF
    # -----------------------------------------

    online_since = (
        now -
        timedelta(
            seconds=30
        )
    )


    # -----------------------------------------
    # COUNT ONLINE VISITORS
    # -----------------------------------------

    online_count = (
        presence_collection.count_documents(
            {
                "last_seen": {
                    "$gte":
                        online_since
                }
            }
        )
    )


    # -----------------------------------------
    # RESPONSE
    # -----------------------------------------

    response = jsonify(
        {
            "success": True,

            "online":
                online_count
        }
    )


    # -----------------------------------------
    # SAVE VISITOR COOKIE
    # -----------------------------------------

    if not request.cookies.get(
        "visitor_id"
    ):

        response.set_cookie(

            "visitor_id",

            visitor_id,

            max_age=
                60 * 60 * 24 * 30,

            httponly=True,

            samesite="Lax"
        )


    return response


# =========================================================
# RUN FLASK
# =========================================================

if __name__ == "__main__":

    app.run(
        debug=True
    )