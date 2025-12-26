import SwiftUI

struct ContentView: View {
    @EnvironmentObject var gameManager: ChessGameManager
    @EnvironmentObject var settings: AppSettings
    @State private var showingSettings = false
    
    var body: some View {
        NavigationView {
            VStack {
                if gameManager.gameState == .postGame {
                    PostGameChatView()
                } else {
                    GameView()
                }
            }
            .navigationTitle("ChessChat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Settings") {
                        showingSettings = true
                    }
                }
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
        }
    }
}