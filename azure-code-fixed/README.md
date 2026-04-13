# Azure Code

Azure Code is an open-source AI coding agent for your terminal.
Write, debug, and refactor code using natural language from the command line.

## Quick Start

```bash
# Clone and build
git clone https://github.com/YOUR_USERNAME/azure-code.git
cd azure-code
npm install
npm run build

# Install the CLI globally
npm install -g .

# Set your API key
export AZURE_API_KEY="your-key-here"

# Run
azure
```

## Models

| Model                    | Context | Description                              |
|--------------------------|---------|------------------------------------------|
| Azure Coder 230B Free    | —       | Default — free, auto-selected best model |
| Azure Coder Rapid        | 256K    | Fast agentic coding with reasoning       |
| Azure Coder Titan 120B   | 256K    | 120B MoE — multi-agent, long context     |
| Azure Coder Trinity 400B | 262K    | 400B reasoning MoE — agentic workloads   |
| Azure Coder Dola 230B    | 256K    | Multimodal — browser & computer use      |
| Azure Coder Best         | —       | Always the best available free model     |
| Azure Coder 230B Balanced| —       | Cost-effective paid tier                 |
| Azure Coder 230B Pro     | —       | Maximum capability (paid)                |

Switch models with the `/model` command inside the CLI.

## Configuration

- Settings: `~/.azure/settings.json`
- Project instructions: `AZURE.md` at your project root
- File exclusions: `.azureignore`

## License

Apache 2.0
