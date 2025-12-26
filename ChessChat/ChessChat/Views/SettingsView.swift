import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settings: AppSettings
    @Environment(\.dismiss) private var dismiss
    @State private var tempAPIKey = ""
    @State private var tempSelectedModel: AIModel = AIModelRegistry.defaultModel
    @State private var showingAPIKeyInfo = false
    @State private var isSecureField = true
    @State private var showingModelInfo = false
    
    var body: some View {
        NavigationView {
            Form {
                // MARK: - AI Model Selection
                Section(header: Text("AI Model Selection")) {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Chess Opponent")
                                .font(.headline)
                            
                            Spacer()
                            
                            Button(action: { showingModelInfo = true }) {
                                Image(systemName: "info.circle")
                                    .foregroundColor(.blue)
                            }
                        }
                        
                        Picker("Model", selection: $tempSelectedModel) {
                            ForEach(AIModelRegistry.allModels) { model in
                                VStack(alignment: .leading) {
                                    Text(model.displayName)
                                        .font(.body)
                                    Text(model.description)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                .tag(model)
                            }
                        }
                        .pickerStyle(.navigationLink)
                        
                        // Model details
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Image(systemName: "cpu")
                                    .foregroundColor(.blue)
                                Text("Selected: \(tempSelectedModel.displayName)")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                            }
                            
                            Text(tempSelectedModel.description)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            // Show warning for non-OpenAI models
                            if tempSelectedModel.provider != .openai {
                                HStack(alignment: .top, spacing: 6) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .foregroundColor(.orange)
                                        .font(.caption)
                                    Text("This model is not yet available. Coming soon!")
                                        .font(.caption)
                                        .foregroundColor(.orange)
                                }
                                .padding(.top, 4)
                            }
                        }
                        .padding(12)
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                    }
                }
                
                Section(header: Text("OpenAI Configuration")) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("API Key")
                                .font(.headline)
                            
                            Spacer()
                            
                            Button(action: { showingAPIKeyInfo = true }) {
                                Image(systemName: "info.circle")
                                    .foregroundColor(.blue)
                            }
                        }
                        
                        HStack {
                            Group {
                                if isSecureField {
                                    SecureField("Enter your OpenAI API key", text: $tempAPIKey)
                                } else {
                                    TextField("Enter your OpenAI API key", text: $tempAPIKey)
                                }
                            }
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            
                            Button(action: { isSecureField.toggle() }) {
                                Image(systemName: isSecureField ? "eye.slash" : "eye")
                                    .foregroundColor(.gray)
                            }
                        }
                        
                        if !tempAPIKey.isEmpty {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text("API key entered")
                                    .font(.caption)
                                    .foregroundColor(.green)
                            }
                        } else if !settings.openAIAPIKey.isEmpty {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text("API key configured")
                                    .font(.caption)
                                    .foregroundColor(.green)
                            }
                        }
                    }
                }
                
                Section(header: Text("About")) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ChessChat v1.0")
                            .font(.headline)
                        
                        Text("A simple chess app where you can play against AI and analyze your games with intelligent chat.")
                            .font(.body)
                            .foregroundColor(.secondary)
                        
                        Text("Features:")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .padding(.top, 8)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("• Play chess against OpenAI")
                            Text("• Legal move validation")
                            Text("• Post-game analysis chat")
                            Text("• PGN and FEN support")
                        }
                        .font(.body)
                        .foregroundColor(.secondary)
                    }
                }
                
                Section(header: Text("Privacy & Security")) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Your API key is stored locally on your device and is only used to communicate with OpenAI's servers.")
                            .font(.body)
                            .foregroundColor(.secondary)
                        
                        Text("Game data (moves, positions) is sent to OpenAI only for analysis purposes when you use the chat feature.")
                            .font(.body)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveSettings()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .onAppear {
            tempAPIKey = settings.openAIAPIKey
            tempSelectedModel = settings.selectedModel
        }
        .alert("AI Model Selection", isPresented: $showingModelInfo) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("Choose which AI model to play against and chat with.\n\n• GPT-4o Mini: Fast and cost-effective\n• GPT-4o: Most capable reasoning\n• GPT-4 Turbo: High performance\n• GPT-3.5 Turbo: Economical option\n\nOther providers (Claude, Grok, Gemini, Mistral) are coming soon!")
        }
        .alert("OpenAI API Key", isPresented: $showingAPIKeyInfo) {
            Button("Get API Key") {
                if let url = URL(string: "https://platform.openai.com/api-keys") {
                    UIApplication.shared.open(url)
                }
            }
            Button("OK", role: .cancel) { }
        } message: {
            Text("You need an OpenAI API key to use the AI opponent and chat features.\n\n1. Go to platform.openai.com\n2. Sign up or log in\n3. Navigate to API Keys\n4. Create a new secret key\n5. Copy and paste it here\n\nNote: API usage will be charged to your OpenAI account.")
        }
    }
    
    private func saveSettings() {
        settings.saveAPIKey(tempAPIKey)
        settings.saveSelectedModel(tempSelectedModel)
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppSettings())
}