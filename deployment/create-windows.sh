#!/bin/sh
# Create Premium Window
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"type":"window","model":"Window-Premium-2025","metadata":{"description":"Premium double-glazed window","dimensions":{"width":1200,"height":1500}}}' \
  http://localhost:3000/api/products/create
echo ""

# Create Energy Efficient Window
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"type":"window","model":"Window-EnergyEfficient-Triple","metadata":{"description":"Triple glazed energy efficient window","dimensions":{"width":1000,"height":1200}}}' \
  http://localhost:3000/api/products/create
echo ""

# Create Standard Window
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"type":"window","model":"Window-Standard-Single","metadata":{"description":"Standard single pane window","dimensions":{"width":800,"height":1000}}}' \
  http://localhost:3000/api/products/create
echo ""
