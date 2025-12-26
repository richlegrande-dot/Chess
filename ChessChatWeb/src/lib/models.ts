// AI Model Definitions (migrated from iOS LLMModels.swift)

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  modelIdentifier: string;
  description: string;
  displayName: string;
}

export enum AIProvider {
  OpenAI = 'OpenAI',
  Anthropic = 'Anthropic',
  XAI = 'xAI',
  Google = 'Google',
  Mistral = 'Mistral',
}

export class AIModelRegistry {
  static readonly allModels: AIModel[] = [
    // OpenAI Models (Active)
    {
      id: 'openai-gpt4o-mini',
      name: 'GPT-4o Mini',
      provider: AIProvider.OpenAI,
      modelIdentifier: 'gpt-4o-mini',
      description: 'Fast and cost-effective model, great for chess moves',
      displayName: 'OpenAI: GPT-4o Mini',
    },
    {
      id: 'openai-gpt4o',
      name: 'GPT-4o',
      provider: AIProvider.OpenAI,
      modelIdentifier: 'gpt-4o',
      description: 'Most capable OpenAI model with advanced reasoning',
      displayName: 'OpenAI: GPT-4o',
    },
    {
      id: 'openai-gpt4-turbo',
      name: 'GPT-4 Turbo',
      provider: AIProvider.OpenAI,
      modelIdentifier: 'gpt-4-turbo',
      description: 'High performance GPT-4 model',
      displayName: 'OpenAI: GPT-4 Turbo',
    },
    {
      id: 'openai-gpt35-turbo',
      name: 'GPT-3.5 Turbo',
      provider: AIProvider.OpenAI,
      modelIdentifier: 'gpt-3.5-turbo',
      description: 'Fast and economical choice for basic chess play',
      displayName: 'OpenAI: GPT-3.5 Turbo',
    },
    // Anthropic Claude Models (Coming Soon)
    {
      id: 'anthropic-claude-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: AIProvider.Anthropic,
      modelIdentifier: 'claude-3-5-sonnet-20241022',
      description: 'Advanced reasoning with excellent chess analysis',
      displayName: 'Anthropic: Claude 3.5 Sonnet',
    },
    {
      id: 'anthropic-claude-haiku',
      name: 'Claude 3 Haiku',
      provider: AIProvider.Anthropic,
      modelIdentifier: 'claude-3-haiku-20240307',
      description: 'Fast and efficient for quick chess moves',
      displayName: 'Anthropic: Claude 3 Haiku',
    },
    // xAI Grok Models (Coming Soon)
    {
      id: 'xai-grok-2',
      name: 'Grok-2',
      provider: AIProvider.XAI,
      modelIdentifier: 'grok-2-latest',
      description: 'Powerful reasoning and creative chess play',
      displayName: 'xAI: Grok-2',
    },
    // Google Gemini Models (Coming Soon)
    {
      id: 'google-gemini-pro',
      name: 'Gemini 1.5 Pro',
      provider: AIProvider.Google,
      modelIdentifier: 'gemini-1.5-pro',
      description: 'Google\'s most capable model for complex tasks',
      displayName: 'Google: Gemini 1.5 Pro',
    },
    {
      id: 'google-gemini-flash',
      name: 'Gemini 1.5 Flash',
      provider: AIProvider.Google,
      modelIdentifier: 'gemini-1.5-flash',
      description: 'Fast and efficient for quick responses',
      displayName: 'Google: Gemini 1.5 Flash',
    },
    // Mistral Models (Coming Soon)
    {
      id: 'mistral-large',
      name: 'Mistral Large',
      provider: AIProvider.Mistral,
      modelIdentifier: 'mistral-large-latest',
      description: 'Top-tier model with strong reasoning capabilities',
      displayName: 'Mistral: Large',
    },
  ];

  // Only OpenAI models are currently implemented
  private static readonly implementedProviders: AIProvider[] = [AIProvider.OpenAI];

  static get implementedModels(): AIModel[] {
    return this.allModels.filter((m) => this.implementedProviders.includes(m.provider));
  }

  static get upcomingModels(): AIModel[] {
    return this.allModels.filter((m) => !this.implementedProviders.includes(m.provider));
  }

  static isModelImplemented(model: AIModel): boolean {
    return this.implementedProviders.includes(model.provider);
  }

  static get defaultModel(): AIModel {
    return this.allModels[0]; // GPT-4o Mini
  }

  static getModel(id: string): AIModel | undefined {
    return this.allModels.find((m) => m.id === id);
  }

  static getModelsByProvider(provider: AIProvider): AIModel[] {
    return this.allModels.filter((m) => m.provider === provider);
  }
}

// Chat Message Types
export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

// Game Context for Chat
export interface GameContext {
  finalFEN: string;
  pgn: string;
  result: string;
}

// Game State Types
export enum GameState {
  Playing = 'playing',
  PostGame = 'postGame',
}

export enum GameResult {
  CheckmateWhite = 'Checkmate - White wins',
  CheckmateBlack = 'Checkmate - Black wins',
  Stalemate = 'Stalemate - Draw',
  InsufficientMaterial = 'Insufficient material - Draw',
  ThreefoldRepetition = 'Threefold repetition - Draw',
  FiftyMoveRule = 'Fifty-move rule - Draw',
  WhiteResigned = 'White resigned - Black wins',
  BlackResigned = 'Black resigned - White wins',
}

// Chess conversation message for gameplay chat
export interface ChessConversationMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  moveContext?: string;
}

// API Request/Response Types
export interface ChessMoveRequest {
  fen: string;
  pgn: string;
  model: string; // model identifier
  gameId?: string;
  userMove?: string;
  chatHistory?: ChessConversationMessage[];
}

export interface ChessMoveResponse {
  move: string; // UCI format
  success: boolean;
  error?: string;
  gameId?: string;
  chatHistory?: ChessConversationMessage[];
  conversationalResponse?: string;
}

export interface ChatRequest {
  message: string;
  gameContext: GameContext;
  chatHistory: ChatMessage[];
  model: string; // model identifier
}

export interface ChatResponse {
  response: string;
  success: boolean;
  error?: string;
}

// Error Types
export enum LLMErrorType {
  NoAPIKey = 'NO_API_KEY',
  InvalidAPIKey = 'INVALID_API_KEY',
  RateLimited = 'RATE_LIMITED',
  ServerError = 'SERVER_ERROR',
  NetworkTimeout = 'NETWORK_TIMEOUT',
  InvalidMoveFormat = 'INVALID_MOVE_FORMAT',
  ProviderNotImplemented = 'PROVIDER_NOT_IMPLEMENTED',
}

export class LLMError extends Error {
  constructor(
    public type: LLMErrorType,
    message: string
  ) {
    super(message);
    this.name = 'LLMError';
  }

  static getErrorMessage(type: LLMErrorType, provider?: string): string {
    switch (type) {
      case LLMErrorType.NoAPIKey:
        return 'API key not set. Please configure your API key in Settings.';
      case LLMErrorType.InvalidAPIKey:
        return 'Invalid API key. Please check your API key in Settings.';
      case LLMErrorType.RateLimited:
        return 'API rate limit exceeded. Please wait a moment and try again.';
      case LLMErrorType.ServerError:
        return 'Server error. Please try again later.';
      case LLMErrorType.NetworkTimeout:
        return 'Network timeout. Please check your connection and try again.';
      case LLMErrorType.InvalidMoveFormat:
        return 'AI returned invalid move format';
      case LLMErrorType.ProviderNotImplemented:
        return `${provider} support is coming soon! For now, please select an OpenAI model in Settings.`;
      default:
        return 'An unknown error occurred.';
    }
  }
}
