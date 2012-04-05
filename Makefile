test:
	@node test/index.js

docs:
	@mkdir -p docs
	@node node_modules/.bin/ape lib/mongojito.js --md --html -o docs

.PHONY: docs test