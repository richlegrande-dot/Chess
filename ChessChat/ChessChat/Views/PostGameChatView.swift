import SwiftUI

struct PostGameChatView: View {
    @EnvironmentObject var gameManager: ChessGameManager
    @EnvironmentObject var appSettings: AppSettings
    @State private var chatMessages: [ChatMessage] = []
    @State private var messageText = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    private var gameContext: GameContext {
        GameContext(
            finalFEN: gameManager.board.generateFEN(),
            pgn: gameManager.board.generatePGN(),
            result: gameResultString
        )
    }
    
    private var gameResultString: String {
        if case .gameOver(let result) = gameManager.gameState {
            return result.description
        }
        return "Game in progress"
    }
    
    var body: some View {
        VStack {
            // Header
            HStack {
                Button("← Back to Game") {
                    gameManager.returnToGame()
                }
                .font(.headline)
                .foregroundColor(.blue)
                
                Spacer()
                
                Text("Game Analysis")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button("Clear Chat") {
                    chatMessages.removeAll()
                }
                .font(.headline)
                .foregroundColor(.red)
            }
            .padding()
            
            // Game Summary
            GameSummaryView(
                result: gameResultString,
                pgn: gameManager.board.generatePGN()
            )
            .padding(.horizontal)
            
            Divider()
            
            // Chat Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if chatMessages.isEmpty {
                            VStack(spacing: 16) {
                                Image(systemName: "message.circle")
                                    .font(.system(size: 50))
                                    .foregroundColor(.gray)
                                
                                Text("Ask me about your game!")
                                    .font(.title3)
                                    .foregroundColor(.gray)
                                
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Try asking:")
                                        .font(.headline)
                                        .foregroundColor(.primary)
                                    
                                    Text("• Where did I make mistakes?")
                                    Text("• Explain move 14")
                                    Text("• What are better alternatives?")
                                    Text("• How could I have won?")
                                }
                                .font(.body)
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding()
                                .background(Color.blue.opacity(0.1))
                                .cornerRadius(12)
                            }
                            .padding()
                        } else {
                            ForEach(chatMessages) { message in
                                ChatMessageView(message: message)
                                    .id(message.id)
                            }
                        }
                        
                        if isLoading {
                            HStack {
                                ProgressView()
                                    .scaleEffect(0.8)
                                Text("AI is analyzing...")
                                    .foregroundColor(.gray)
                                Spacer()
                            }
                            .padding()
                        }
                    }
                    .padding()
                }
                .onChange(of: chatMessages.count) { _ in
                    if let lastMessage = chatMessages.last {
                        withAnimation {
                            proxy.scrollTo(lastMessage.id, anchor: .bottom)
                        }
                    }
                }
            }
            
            // Error Message
            if let error = errorMessage {
                Text(error)
                    .foregroundColor(.red)
                    .padding(.horizontal)
                    .multilineTextAlignment(.center)
            }
            
            // Input Area
            VStack(spacing: 8) {
                HStack {
                    TextField("Ask about the game...", text: $messageText, axis: .vertical)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .lineLimit(1...4)
                        .font(.body)
                    
                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundColor(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading ? .gray : .blue)
                    }
                    .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
                }
                
                HStack {
                    Text("💡 Try: 'Where did I go wrong?' or 'Explain in simple terms'")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
            }
            .padding()
        }
        .navigationBarHidden(true)
    }
    
    private func sendMessage() {
        let message = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }
        sendQuickMessage(message)
    }
    
    private func sendQuickMessage(_ message: String) {
        // Add user message
        let userMessage = ChatMessage(content: message, isUser: true)
        chatMessages.append(userMessage)
        
        // Clear input
        messageText = ""
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                // Get selected model from settings
                let selectedModel = appSettings.selectedModel
                
                // Get the appropriate service for the selected model
                let llmService = LLMServiceFactory.shared.service(for: selectedModel)
                
                // Check if service is configured
                guard llmService.isConfigured() else {
                    await MainActor.run {
                        self.errorMessage = "\(selectedModel.provider.rawValue) API key not set. Please add your API key in Settings."
                        self.isLoading = false
                    }
                    return
                }
                
                let response = try await llmService.sendChatMessage(
                    message,
                    gameContext: gameContext,
                    chatHistory: chatMessages,
                    model: selectedModel
                )
                
                await MainActor.run {
                    let aiMessage = ChatMessage(content: response, isUser: false)
                    self.chatMessages.append(aiMessage)
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
}

struct GameSummaryView: View {
    let result: String
    let pgn: String
    @State private var showingPGN = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Game Result:")
                    .font(.headline)
                
                Spacer()
                
                Text(result)
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(resultColor)
            }
            
            HStack {
                Text("Moves: \(moveCount)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Button("View PGN") {
                    showingPGN = true
                }
                .font(.subheadline)
                .foregroundColor(.blue)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(12)
        .sheet(isPresented: $showingPGN) {
            PGNView(pgn: pgn)
        }
    }
    
    private var resultColor: Color {
        switch result {
        case "White Wins":
            return .green
        case "Black Wins":
            return .red
        case "Draw", "Stalemate":
            return .orange
        default:
            return .primary
        }
    }
    
    private var moveCount: Int {
        return pgn.components(separatedBy: " ").filter { $0.contains(".") }.count
    }
}

struct ChatMessageView: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.isUser {
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text(message.content)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(16, corners: [.topLeft, .topRight, .bottomLeft])
                    
                    Text(formatTime(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity * 0.75, alignment: .trailing)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "brain.head.profile")
                            .foregroundColor(.blue)
                        
                        Text("Chess Coach")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.blue)
                        
                        Spacer()
                    }
                    
                    Text(message.content)
                        .padding()
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(16, corners: [.topRight, .bottomLeft, .bottomRight])
                    
                    Text(formatTime(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity * 0.85, alignment: .leading)
                
                Spacer()
            }
        }
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct PGNView: View {
    let pgn: String
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                Text(pgn)
                    .font(.system(.body, design: .monospaced))
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationTitle("Game PGN")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct QuickQuestionButton: View {
    let question: String
    let sendMessage: (String) -> Void
    
    var body: some View {
        Button(action: { sendMessage(question) }) {
            Text(question)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.blue)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - View Extensions
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners
    
    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}