#!/bin/sh
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"type":"window","model":"W-1200","metadata":{}}' \
  http://localhost:3000/api/products/create
