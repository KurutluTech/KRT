# Spreadsheet import spec
Flow: upload → preview → column mapping → validation → duplicate detection → owner approval → import. Required: category code, amount, currency, period start/end. Optional: document ref, cost center, description.
Rules: TR (1.234,56) or EN (1,234.56) locale chosen explicitly; dates DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD only (impossible dates rejected); currencies TRY/EUR/USD/GBP; cells starting with = + - @ are neutralised as text, never evaluated; duplicates by row fingerprint inside the file and against earlier imports; row-level error list. Nothing is written until a batch decision.
Supported: CSV (`;` `,` tab, quotes). **DEFERRED:** .xlsx parsing.
