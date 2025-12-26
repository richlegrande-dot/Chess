import SwiftUI

@main
struct ChessChatApp: App {
    @StateObject private var settings = AppSettings()
    @StateObject private var gameManager: ChessGameManager
    
    init() {
        let settings = AppSettings()
        _settings = StateObject(wrappedValue: settings)
        _gameManager = StateObject(wrappedValue: ChessGameManager(appSettings: settings))
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(gameManager)
                .environmentObject(settings)
        }
    }
}