import requests
import urllib.parse
from datetime import datetime

headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZHFwa3VjZWpjdGRvZG1rb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjM2MzMsImV4cCI6MjA4NjAzOTYzM30.KYOCRTl3y0kIQsCc5QK7uPcsxYfhus_sSuUVzv1mvNU",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZHFwa3VjZWpjdGRvZG1rb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjM2MzMsImV4cCI6MjA4NjAzOTYzM30.KYOCRTl3y0kIQsCc5QK7uPcsxYfhus_sSuUVzv1mvNU",
    "Content-Type": "application/json"
}

# Delete all attendance records for TEST_LIVE slot today
today_iso = f"{datetime.now().strftime('%Y-%m-%d')}T00:00:00"
url = f"https://pmdqpkucejctdodmkoym.supabase.co/rest/v1/attendance_log?service_slot=eq.TEST_LIVE"

response = requests.delete(url, headers=headers)
print("Delete TEST_LIVE Logs - Status Code:", response.status_code)
print("Response:", response.text)

