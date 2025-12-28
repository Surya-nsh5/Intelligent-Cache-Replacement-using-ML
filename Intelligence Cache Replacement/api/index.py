import sys, os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(BASE_DIR, "..")

sys.path.append(ROOT)

from app import app   # imports your real Flask app

