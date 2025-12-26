# Phase-2 Migration Guide

## Quick Start: What Changed?

### For Developers Working on the Codebase

**TL;DR:** The app now supports multiple AI models. All OpenAI-specific code is now behind a `LLMService` protocol.

## Breaking Changes

### 1. OpenAIService API Changes

**Before (Phase-1):**
```swift
let service = OpenAIService()
let move = try await service.getChessMove(fen: fen, pgn: pgn)
let response = try await service.sendChatMessage(message, gameContext: context)
```

**After (Phase-2):**
```swift
let model = appSettings.selectedModel
let service = LLMServiceFactory.shared.service(for: model)
let move = try await service.getChessMove(fen: fen, pgn: pgn, model: model)
let response = try await service.sendChatMessage(message, gameContext: context, chatHistory: chatHistory, model: model)
```

### 2. Error Handling Changes

**Before:**
```swift
catch let error as OpenAIError {
    // Handle OpenAI-specific errors
}
```

**After:**
```swift
catch let error as LLMError {
    // Handle unified LLM errors (works for all providers)
}
```

### 3. GameManager Initialization

**Before:**
```swift
@StateObject private var gameManager = ChessGameManager()
```

**After:**
```swift
let settings = AppSettings()
_settings = StateObject(wrappedValue: settings)
_gameManager = StateObject(wrappedValue: ChessGameManager(appSettings: settings))
```

### 4. Chat Message Management

**Before:**
```swift
@StateObject private var openAIService = OpenAIService()
// Service manages chat messages internally
```

**After:**
```swift
@State private var chatMessages: [ChatMessage] = []
// View manages chat messages, service is stateless
```

## New Files to Import

If you're working on AI-related features, import these:

```swift
// For model definitions
import LLMModels

// For service protocol and factory
import LLMService

// For chat models
import ChatModels
```

## Common Migration Patterns

### Pattern 1: Making AI Chess Moves

**Old Pattern:**
```swift
private let openAIService = OpenAIService()

func makeMove() {
    let move = try await openAIService.getChessMove(fen: fen, pgn: pgn)
}
```

**New Pattern:**
```swift
weak var appSettings: AppSettings?

func makeMove() {
    guard let model = appSettings?.selectedModel else { return }
    let service = LLMServiceFactory.shared.service(for: model)
    guard service.isConfigured() else {
        // Show error: API key not set
        return
    }
    let move = try await service.getChessMove(fen: fen, pgn: pgn, model: model)
}
```

### Pattern 2: Handling Chat

**Old Pattern:**
```swift
@StateObject private var openAIService = OpenAIService()

func sendMessage(_ text: String) {
    openAIService.addMessage(text, isUser: true)
    let response = try await openAIService.sendChatMessage(text, gameContext: context)
    openAIService.addMessage(response, isUser: false)
}
```

**New Pattern:**
```swift
@EnvironmentObject var appSettings: AppSettings
@State private var chatMessages: [ChatMessage] = []

func sendMessage(_ text: String) {
    let userMessage = ChatMessage(content: text, isUser: true)
    chatMessages.append(userMessage)
    
    let model = appSettings.selectedModel
    let service = LLMServiceFactory.shared.service(for: model)
    let response = try await service.sendChatMessage(text, gameContext: context, chatHistory: chatMessages, model: model)
    
    let aiMessage = ChatMessage(content: response, isUser: false)
    chatMessages.append(aiMessage)
}
```

### Pattern 3: Checking Configuration

**Old Pattern:**
```swift
if openAIService.apiKey.isEmpty {
    showError("API key not set")
}
```

**New Pattern:**
```swift
let model = appSettings.selectedModel
let service = LLMServiceFactory.shared.service(for: model)
if !service.isConfigured() {
    showError("\(model.provider.rawValue) API key not set")
}
```

## Testing Your Changes

### Unit Tests
```swift
func testAIMove() {
    let settings = AppSettings()
    settings.selectedModel = AIModelRegistry.defaultModel
    settings.saveAPIKey("test-key")
    
    let gameManager = ChessGameManager(appSettings: settings)
    // ... test logic
}
```

### Mock Service
```swift
class MockLLMService: LLMService {
    func getChessMove(fen: String, pgn: String, model: AIModel) async throws -> String {
        return "e2e4" // Always return this move
    }
    
    func sendChatMessage(_ message: String, gameContext: GameContext, chatHistory: [ChatMessage], model: AIModel) async throws -> String {
        return "Mocked response"
    }
    
    func isConfigured() -> Bool { return true }
    func getAPIKey() -> String { return "mock-key" }
}
```

## FAQ

### Q: Do I need to change my existing game logic?
**A:** No, chess logic is unchanged. Only AI integration code needs updates.

### Q: Can I still use OpenAI directly?
**A:** Yes, but it's better to use the factory pattern for consistency.

### Q: How do I add a new model?
**A:** Just add it to `AIModelRegistry.allModels`. The UI will automatically show it.

### Q: What if I want to use a different model for chess vs. chat?
**A:** Currently not supported, but you could add `selectedChessModel` and `selectedChatModel` to `AppSettings`.

### Q: How do I test with different models?
**A:** Change `appSettings.selectedModel` before running your test.

## Need Help?

- See [PHASE2_IMPLEMENTATION.md](PHASE2_IMPLEMENTATION.md) for full details
- Check [OpenAIService.swift](ChessChat/Services/OpenAIService.swift) for example implementation
- Look at [PostGameChatView.swift](ChessChat/Views/PostGameChatView.swift) for usage patterns

---

**Last Updated:** December 10, 2025  
**Phase:** 2  
**Status:** Complete
