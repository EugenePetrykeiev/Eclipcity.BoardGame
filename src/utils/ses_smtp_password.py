#!/usr/bin/env python3

import hmac
import hashlib
import base64
import sys

MESSAGE = "SendRawEmail"
VERSION = b"\x04"

def sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

if len(sys.argv) != 3:
    print("Usage: python3 ses_smtp_password.py <secret_access_key> <region>")
    sys.exit(1)

secret_access_key = sys.argv[1]
region = sys.argv[2]

signature = sign(("AWS4" + secret_access_key).encode("utf-8"), region)
signature = sign(signature, "ses")
signature = sign(signature, "aws4_request")
signature = sign(signature, MESSAGE)

smtp_password = base64.b64encode(VERSION + signature).decode("utf-8")
print(smtp_password)