#!/bin/bash
git config user.email "vinicius@vmont3.com"
git config user.name "vmont3"
git add .
git commit -m "feat(hackathon): Quantum Cert Neobank + Multi-Sig Escrow - Final Submission V1.05.01"
git branch -M main
git remote set-url origin https://github.com/vmont3/QUANTUM-CERT-bootcamp-solana-escrow-neobank.git || git remote add origin https://github.com/vmont3/QUANTUM-CERT-bootcamp-solana-escrow-neobank.git
git push -f origin main
