# Proposed New Folder Structure for ZS4

zs4/
├── core/                  # The preserved soul
│   ├── types/             # All native types (user, consent, spirit, media...)
│   ├── transforms/        # Transform pipeline
│   ├── engine/            # Main zs4.js logic
│   └── flags/             # Permission & behavior flags
│
├── modules/               # Modern modular extensions
│   ├── consent/           # Consent engine
│   ├── spirit/            # Digital twin & adapters
│   ├── community/         # Community scopes
│   ├── ai/                # AI-to-AI protocols
│   └── monetization/      # Payments, tiers, licensing
│
├── api/                   # New clean REST + WebSocket API layer
├── frontend/              # Modern UI (Next.js / Svelte)
├── data/                  # JSON files (current driver)
├── storage/               # Driver system (json, mongodb, future...)
├── design/                # Architecture docs ← you are here
├── scripts/               # Migration & maintenance
├── docker/                # Deployment
├── LICENSE
├── README.md
└── package.json