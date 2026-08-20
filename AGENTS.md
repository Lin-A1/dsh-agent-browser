# dsh-agent-browser

This repository is an out-of-tree DeepSeek Harness function plugin. Keep the
public entry point as named `name`, `inject`, `Config`, and `apply` exports;
there is intentionally no default export. The plugin owns only CLI invocation
and tool registration. Do not modify or vendor deepseek-harness here.
