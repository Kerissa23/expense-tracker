from dotenv import load_dotenv
load_dotenv()
import os
if os.environ.get("FLASK_ENV") == "development":
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

from flask import Flask, redirect, url_for, session, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, logout_user, login_required, UserMixin, current_user
from requests_oauthlib import OAuth2Session
import os
from datetime import datetime
from collections import defaultdict
import requests

app = Flask(__name__)
app.config['SESSION_COOKIE_NAME'] = 'budget_session'

#app.secret_key = os.urandom(24)
app.secret_key = os.environ.get("FLASK_SECRET_KEY")
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///budget.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)

# OAuth config
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"

REDIRECT_URI = os.environ.get("REDIRECT_URI")

# === Models ===

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    google_id = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True)
    budget = db.Column(db.Float, default=0.0)

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    title = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    category = db.Column(db.String(50), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# === Google OAuth2 functions ===

def get_google_provider_cfg():
    return requests.get(GOOGLE_DISCOVERY_URL).json()

@app.route("/login")
def login():
    session.permanent = True
    google = OAuth2Session(GOOGLE_CLIENT_ID, redirect_uri=REDIRECT_URI, scope=["openid", "email", "profile"])
    authorization_url, state = google.authorization_url(
        get_google_provider_cfg()["authorization_endpoint"],
        access_type="offline", prompt="consent"
    )
    print("Authorization URL:", authorization_url)
    session["oauth_state"] = state
    return redirect(authorization_url)

@app.route("/login/callback")
def callback():
    if "oauth_state" not in session:
        return "Session expired or invalid state. Please try logging in again.", 400

    google = OAuth2Session(GOOGLE_CLIENT_ID, state=session["oauth_state"], redirect_uri=REDIRECT_URI)

    try:
        token = google.fetch_token(
            get_google_provider_cfg()["token_endpoint"],
            client_secret=GOOGLE_CLIENT_SECRET,
            authorization_response=request.url
        )
    except Exception as e:
        return f"Error fetching token: {str(e)}", 400

    userinfo = google.get(get_google_provider_cfg()["userinfo_endpoint"]).json()
    session['profile_pic_url'] = userinfo.get('picture')
    user = User.query.filter_by(google_id=userinfo["sub"]).first()
    if not user:
        user = User(google_id=userinfo["sub"], name=userinfo["name"], email=userinfo["email"])
        db.session.add(user)
        db.session.commit()

    login_user(user)
    session.permanent = True
    return redirect(url_for("dashboard"))


@app.route("/logout")
@login_required
def logout():
    print(f"[DEBUG] Logging out user: {current_user.email}")
    logout_user()
    return redirect("/")

@app.route("/")
def home():
    return render_template("home.html")

from collections import defaultdict
from flask_login import current_user
from datetime import datetime

@app.route("/dashboard")
@login_required
def dashboard():
    print(f"[DEBUG] Logged in as: {current_user.name} ({current_user.email}), ID: {current_user.id}")
    expenses_query = Expense.query.filter_by(user_id=current_user.id).order_by(Expense.date.desc()).all()

    # Convert model instances to dicts
    expenses = [
        {
            "id": exp.id,
            "title": exp.title,
            "amount": exp.amount,
            "date": exp.date.isoformat(),
            "category": exp.category
        }
        for exp in expenses_query
    ]

    # Build chart data
    grouped = defaultdict(lambda: defaultdict(float))
    all_categories = set()
    month_keys = []

    for exp in expenses:
        date_obj = datetime.fromisoformat(exp["date"])
        month_label = date_obj.strftime("%B %Y")
        grouped[month_label][exp["category"]] += exp["amount"]
        all_categories.add(exp["category"])
        if month_label not in month_keys:
            month_keys.append(month_label)

    chart_data = {
        "labels": month_keys,
        "datasets": []
    }

    for category in sorted(all_categories):
        chart_data["datasets"].append({
            "label": category,
            "data": [grouped[month].get(category, 0) for month in month_keys]
        })

    # Calculate total expense and remaining budget
    total_expense = sum(exp["amount"] for exp in expenses)
    total_budget = current_user.budget or 0.0
    remaining = total_budget - total_expense

    return render_template(
        "index.html",
        expenses=expenses,
        chart_data=chart_data,
        total_budget=total_budget,
        total_expense=total_expense,
        remaining=remaining
    )
@app.route("/budget", methods=["GET"])
@login_required
def get_budget():
    return jsonify({"budget": current_user.budget})

@app.route("/budget", methods=["POST"])
@login_required
def update_budget():
    data = request.get_json()
    if 'budget' not in data:
        return jsonify({"error": "Missing budget field"}), 400

    try:
        budget_value = float(data['budget'])
        current_user.budget = budget_value
        db.session.commit()
        return jsonify({"message": "Budget updated successfully"}), 200
    except ValueError:
        return jsonify({"error": "Invalid budget value"}), 400

# === Expense routes ===

@app.route("/add-expense", methods=["POST"])
@login_required
def add_expense():
    data = request.json
    try:
        date_obj = datetime.strptime(data["date"], "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

    new_expense = Expense(
        user_id=current_user.id,
        title=data["title"],
        amount=data["amount"],
        date=date_obj,
        category=data["category"]
    )
    db.session.add(new_expense)
    db.session.commit()
    return jsonify({"message": "Expense added"})

@app.route("/expenses")
@login_required
def get_expenses():
    expenses = Expense.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        "id": e.id,
        "title": e.title,
        "amount": e.amount,
        "date": e.date.strftime("%Y-%m-%d"),  # Convert date to string
        "category": e.category
    } for e in expenses])

@app.route("/delete-expense/<int:id>", methods=["DELETE"])
@login_required
def delete_expense(id):
    exp = Expense.query.get_or_404(id)
    if exp.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    db.session.delete(exp)
    db.session.commit()
    return jsonify({"message": "Deleted"})

@app.route("/past-expenses")
@login_required
def past_expenses():
    expenses = Expense.query.filter_by(user_id=current_user.id).order_by(Expense.date).all()
    print(expenses)
    grouped = defaultdict(lambda: defaultdict(float))
    all_categories = set()
    month_keys = []

    for exp in expenses:
        date_obj = exp.date  # already a date
        month_label = date_obj.strftime("%B %Y")
        grouped[month_label][exp.category] += exp.amount
        all_categories.add(exp.category)
        if month_label not in month_keys:
            month_keys.append(month_label)

    chart_data = {
        "labels": month_keys,
        "datasets": []
    }

    for category in sorted(all_categories):
        chart_data["datasets"].append({
            "label": category,
            "data": [grouped[month].get(category, 0) for month in month_keys]
        })

    return render_template("past_expenses.html", chart_data=chart_data, grouped_expenses=grouped)

@app.route('/initdb')
def initdb():
    with app.app_context():
        db.create_all()
    return "Database tables created!"

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
