# ChessChat Phase-2 Quick Reference

## Available Models (December 2025)

### ✅ Ready to Use (OpenAI)
| Model | Best For | Speed | Cost |
|-------|----------|-------|------|
| GPT-4o Mini | Quick games, testing | ⚡⚡⚡ Fast | 💰 Low |
| GPT-3.5 Turbo | Budget-friendly play | ⚡⚡⚡ Fast | 💰 Very Low |
| GPT-4 Turbo | Strong gameplay | ⚡⚡ Medium | 💰💰 Medium |
| GPT-4o | Best reasoning | ⚡ Slower | 💰💰💰 High |

### 🔜 Coming Soon
- **Claude 3 Opus** (Anthropic) - Most powerful
- **Claude 3.5 Sonnet** (Anthropic) - Balanced
- **Grok Beta** (xAI) - Conversational
- **Gemini Pro** (Google) - Advanced
- **Mistral Large** (Mistral) - Flagship

## Code Quick Reference

### Get Selected Model
```swift
let model = appSettings.selectedModel
// Returns: AIModel instance
```

### Get Service for Model
```swift
let service = LLMServiceFactory.shared.service(for: model)
// Returns: LLMService conforming instance
```

### Check if Configured
```swift
if service.isConfigured() {
    // API key is set, ready to use
} else {
    // Show error: API key not set
}
```

### Make Chess Move
```swift
let move = try await service.getChessMove(
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    pgn: "1. e4",
    model: model
)
// Returns: UCI move like "e2e4"
```

### Send Chat Message
```swift
let response = try await service.sendChatMessage(
    "Where did I go wrong?",
    gameContext: gameContext,
    chatHistory: chatMessages,
    model: model
)
// Returns: AI analysis response
```

### Handle Errors
```swift
do {
    let move = try await service.getChessMove(fen: fen, pgn: pgn, model: model)
} catch LLMError.noAPIKey {
    // Show: "API key not set"
} catch LLMError.invalidAPIKey {
    // Show: "Invalid API key"
} catch LLMError.rateLimited {
    // Show: "Rate limit exceeded"
} catch LLMError.providerNotImplemented(let provider) {
    // Show: "Anthropic support is coming soon!"
} catch {
    // Show: Generic error
}
```

## Model Registry API

### Get All Models
```swift
let allModels = AIModelRegistry.allModels
// Returns: [AIModel] (9 models)
```

### Get Models by Provider
```swift
let openAIModels = AIModelRegistry.models(for: .openai)
// Returns: [AIModel] (4 OpenAI models)
```

### Get Implemented Models Only
```swift
let implemented = AIModelRegistry.implementedModels
// Returns: [AIModel] (4 OpenAI models currently)
```

### Get Default Model
```swift
let defaultModel = AIModelRegistry.defaultModel
// Returns: GPT-4o Mini
```

### Find Model by ID
```swift
if let model = AIModelRegistry.model(withId: "openai-gpt4o") {
    // Found GPT-4o
}
```

## Settings Persistence

### Save Model Selection
```swift
appSettings.saveSelectedModel(model)
// Persists to UserDefaults as JSON
```

### Load Saved Model
```swift
let savedModel = appSettings.selectedModel
// Loads from UserDefaults, defaults to GPT-4o Mini
```

### Save API Key
```swift
appSettings.saveAPIKey("sk-...")
// Persists to UserDefaults (use Keychain in production)
```

## UI Components

### Model Picker (in SettingsView)
```swift
Picker("Model", selection: $tempSelectedModel) {
    ForEach(AIModelRegistry.allModels) { model in
        VStack(alignment: .leading) {
            Text(model.displayName)
            Text(model.description)
        }
        .tag(model)
    }
}
```

### Show Selected Model
```swift
Text("Selected: \(appSettings.selectedModel.displayName)")
// Shows: "Selected: OpenAI: GPT-4o Mini"
```

### Show Provider-Specific Warning
```swift
if model.provider != .openai {
    Text("This model is not yet available. Coming soon!")
        .foregroundColor(.orange)
}
```

## Common Patterns

### Pattern: Play Chess with Selected Model
```swift
func makeAIMove() {
    let model = appSettings.selectedModel
    let service = LLMServiceFactory.shared.service(for: model)
    
    guard service.isConfigured() else {
        errorMessage = "\(model.provider.rawValue) API key not set"
        return
    }
    
    Task {
        do {
            let move = try await service.getChessMove(
                fen: board.generateFEN(),
                pgn: board.generatePGN(),
                model: model
            )
            processMove(move)
        } catch {
            handleError(error)
        }
    }
}
```

### Pattern: Chat with Model
```swift
func sendChatMessage(_ text: String) {
    let model = appSettings.selectedModel
    let service = LLMServiceFactory.shared.service(for: model)
    
    chatMessages.append(ChatMessage(content: text, isUser: true))
    
    Task {
        do {
            let response = try await service.sendChatMessage(
                text,
                gameContext: gameContext,
                chatHistory: chatMessages,
                model: model
            )
            chatMessages.append(ChatMessage(content: response, isUser: false))
        } catch {
            handleError(error)
        }
    }
}
```

### Pattern: Model-Specific Settings
```swift
Section(header: Text("AI Model Selection")) {
    Picker("Model", selection: $tempSelectedModel) {
        ForEach(AIModelRegistry.implementedModels) { model in
            Text(model.displayName).tag(model)
        }
    }
    
    // Show provider-specific API key field
    if tempSelectedModel.provider == .openai {
        TextField("OpenAI API Key", text: $openAIKey)
    } else if tempSelectedModel.provider == .anthropic {
        TextField("Anthropic API Key", text: $anthropicKey)
    }
}
```

## Enums & Types

### AIProvider
```swift
enum AIProvider: String {
    case openai = "OpenAI"
    case anthropic = "Anthropic"
    case xai = "xAI"
    case google = "Google"
    case mistral = "Mistral"
}
```

### AIModel
```swift
struct AIModel {
    let id: String                    // "openai-gpt4o-mini"
    let name: String                  // "GPT-4o Mini"
    let provider: AIProvider          // .openai
    let modelIdentifier: String       // "gpt-4o-mini" (for API)
    let description: String           // "Fast and cost-effective"
    var displayName: String { get }   // "OpenAI: GPT-4o Mini"
}
```

### LLMError
```swift
enum LLMError: LocalizedError {
    case noAPIKey
    case invalidAPIKey
    case rateLimited
    case serverError
    case networkTimeout
    case providerNotImplemented(String)
    case modelNotSupported(String)
    // ... others
}
```

## File Organization

```
ChessChat/
├── Models/
│   ├── LLMModels.swift          ← Model definitions & registry
│   ├── ChatModels.swift         ← Chat message & context
│   ├── GameManager.swift        ← Game state (uses selected model)
│   ├── ChessBoard.swift         ← Chess logic (unchanged)
│   └── ChessModels.swift        ← Chess pieces (unchanged)
├── Services/
│   ├── LLMService.swift         ← Protocol & factory
│   ├── OpenAIService.swift      ← OpenAI implementation
│   └── ChessEngineService.swift ← Chess engine (unchanged)
└── Views/
    ├── SettingsView.swift       ← Model selection UI
    ├── PostGameChatView.swift   ← Uses selected model
    └── GameView.swift           ← Chess board (unchanged)
```

## Testing Quick Wins

### Test Model Selection
```swift
let settings = AppSettings()
settings.saveSelectedModel(AIModelRegistry.model(withId: "openai-gpt4o")!)
XCTAssertEqual(settings.selectedModel.id, "openai-gpt4o")
```

### Test Service Factory
```swift
let service = LLMServiceFactory.shared.service(for: .openai)
XCTAssertTrue(service is OpenAIService)
```

### Test Unimplemented Provider
```swift
let service = LLMServiceFactory.shared.service(for: .anthropic)
XCTAssertTrue(service is PlaceholderLLMService)
```

## Performance Tips

- **Cache service instances** if making many calls
- **Prefer GPT-4o Mini** for development/testing (faster, cheaper)
- **Use GPT-4o** for production/tournaments (better quality)
- **Batch chat messages** when possible (service accepts full history)

## Common Gotchas

❌ **Don't do this:**
```swift
// Hardcoded model
let move = try await openAIService.getChessMove(fen: fen, pgn: pgn)
```

✅ **Do this instead:**
```swift
// Use selected model
let service = LLMServiceFactory.shared.service(for: appSettings.selectedModel)
let move = try await service.getChessMove(fen: fen, pgn: pgn, model: appSettings.selectedModel)
```

---

❌ **Don't do this:**
```swift
// Direct service instantiation
let service = OpenAIService()
```

✅ **Do this instead:**
```swift
// Use factory
let service = LLMServiceFactory.shared.service(for: model)
```

---

❌ **Don't do this:**
```swift
// Ignore configuration check
let move = try await service.getChessMove(...)
```

✅ **Do this instead:**
```swift
// Always check first
guard service.isConfigured() else {
    showError("API key not set")
    return
}
let move = try await service.getChessMove(...)
```

## Need More Info?

- **Full Documentation:** [PHASE2_IMPLEMENTATION.md](PHASE2_IMPLEMENTATION.md)
- **Migration Guide:** [PHASE2_MIGRATION_GUIDE.md](PHASE2_MIGRATION_GUIDE.md)
- **Quick Summary:** [PHASE2_SUMMARY.md](PHASE2_SUMMARY.md)
- **Source Code:** Check the actual Swift files for implementation details

---

**Version:** Phase-2  
**Last Updated:** December 10, 2025  
**Status:** Production Ready ✅
