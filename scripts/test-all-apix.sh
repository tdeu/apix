#!/bin/bash

echo "========================================="
echo "APIX Comprehensive Command Testing"
echo "========================================="

# Core Commands
core_commands=(
  "npm run apix:help"
  "npm run apix:health"
  "npm run apix:analyze"
  "npm run apix:status"
  "npm run apix:init"
)

# Integration Commands  
integration_commands=(
  "npm run apix:recommend"
  "npm run apix:add:hts"
  "npm run apix:add:wallet"
  "npm run apix:generate"
)

# Blockchain Commands
blockchain_commands=(
  "npm run apix:create-token"
  "npm run apix:validate"
  "npm run apix:validate:full"
)

# AI Commands (may not exist yet)
ai_commands=(
  "npx ts-node src/cli/index.ts confidence \"Create NFT marketplace\""
  "npx ts-node src/cli/index.ts debug \"Token creation fails\""
)

# Interactive Commands (skip on macOS - timeout command not available)
interactive_commands=(
  # "echo 'exit' | timeout 10 npm run apix:chat"  # Disabled for macOS compatibility
)

# Test all categories
all_commands=("${core_commands[@]}" "${integration_commands[@]}" "${blockchain_commands[@]}" "${ai_commands[@]}" "${interactive_commands[@]}")

total=${#all_commands[@]}
current=0

for cmd in "${all_commands[@]}"; do
  current=$((current + 1))
  echo "[$current/$total] Testing: $cmd"
  npm run test:claude "$cmd"
  sleep 2
done

echo "Testing completed. Check logs/ for failures."