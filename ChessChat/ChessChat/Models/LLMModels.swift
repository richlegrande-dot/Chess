import Foundation

// MARK: - AI Model Definitions

/// Represents a specific AI model configuration
struct AIModel: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let name: String
    let provider: AIProvider
    let modelIdentifier: String
    let description: String
    
    // Convenience computed property for display
    var displayName: String {
        return "\(provider.rawValue): \(name)"
    }
}

/// AI Provider enumeration
enum AIProvider: String, Codable, CaseIterable {
    case openai = "OpenAI"
    case anthropic = "Anthropic"
    case xai = "xAI"
    case google = "Google"
    case mistral = "Mistral"
    
    var requiresAPIKey: Bool {
        return true // All providers currently require API keys
    }
}

// MARK: - Available Models Registry

struct AIModelRegistry {
    static let allModels: [AIModel] = [
        // OpenAI Models
        AIModel(
            id: "openai-gpt4o-mini",
            name: "GPT-4o Mini",
            provider: .openai,
            modelIdentifier: "gpt-4o-mini",
            description: "Fast and cost-effective model, great for chess moves"
        ),
        AIModel(
            id: "openai-gpt4o",
            name: "GPT-4o",
            provider: .openai,
            modelIdentifier: "gpt-4o",
            description: "Most capable OpenAI model with advanced reasoning"
        ),
        AIModel(
            id: "openai-gpt4-turbo",
            name: "GPT-4 Turbo",
            provider: .openai,
            modelIdentifier: "gpt-4-turbo",
            description: "High performance GPT-4 model"
        ),
        AIModel(
            id: "openai-gpt35-turbo",
            name: "GPT-3.5 Turbo",
            provider: .openai,
            modelIdentifier: "gpt-3.5-turbo",
            description: "Fast and economical choice for basic chess play"
        ),
        
        // Anthropic Models (Claude) - Future support
        AIModel(
            id: "anthropic-claude-opus",
            name: "Claude 3 Opus",
            provider: .anthropic,
            modelIdentifier: "claude-3-opus-20240229",
            description: "Most powerful Claude model (Coming Soon)"
        ),
        AIModel(
            id: "anthropic-claude-sonnet",
            name: "Claude 3.5 Sonnet",
            provider: .anthropic,
            modelIdentifier: "claude-3-5-sonnet-20241022",
            description: "Balanced performance and speed (Coming Soon)"
        ),
        
        // xAI Models (Grok) - Future support
        AIModel(
            id: "xai-grok-beta",
            name: "Grok Beta",
            provider: .xai,
            modelIdentifier: "grok-beta",
            description: "xAI's conversational model (Coming Soon)"
        ),
        
        // Google Models (Gemini) - Future support
        AIModel(
            id: "google-gemini-pro",
            name: "Gemini Pro",
            provider: .google,
            modelIdentifier: "gemini-pro",
            description: "Google's advanced AI model (Coming Soon)"
        ),
        
        // Mistral Models - Future support
        AIModel(
            id: "mistral-large",
            name: "Mistral Large",
            provider: .mistral,
            modelIdentifier: "mistral-large-latest",
            description: "Mistral's flagship model (Coming Soon)"
        )
    ]
    
    /// Get models available for a specific provider
    static func models(for provider: AIProvider) -> [AIModel] {
        return allModels.filter { $0.provider == provider }
    }
    
    /// Get models that are currently implemented (not "Coming Soon")
    static var implementedModels: [AIModel] {
        return allModels.filter { $0.provider == .openai }
    }
    
    /// Get default model
    static var defaultModel: AIModel {
        return allModels.first { $0.id == "openai-gpt4o-mini" }!
    }
    
    /// Find model by ID
    static func model(withId id: String) -> AIModel? {
        return allModels.first { $0.id == id }
    }
}
