# ChessChat - Phase 1

A clean, simple iOS chess application where users play against an AI opponent and can analyze their games through an intelligent chat interface.

## Features

### Phase 1 Features
- ✅ **Chess Game**: Play legal chess games against OpenAI's GPT models
- ✅ **AI Opponent**: GPT-4o-mini powers the AI chess player
- ✅ **Move Validation**: Complete chess rule enforcement and legal move validation
- ✅ **Game Analysis**: Post-game chat interface for analyzing moves and strategies
- ✅ **FEN/PGN Support**: Full game state tracking and export
- ✅ **Clean UI**: Accessible design suitable for all ages
- ✅ **Settings**: Easy OpenAI API key configuration

## Project Structure

```
ChessChat/
├── ChessChat/
│   ├── ChessChatApp.swift          # Main app entry point
│   ├── ContentView.swift           # Root view coordinator
│   ├── Models/
│   │   ├── ChessModels.swift       # Chess piece, move, and game state models
│   │   ├── ChessBoard.swift        # Chess board logic and validation
│   │   └── GameManager.swift       # Game state management
│   ├── Views/
│   │   ├── GameView.swift          # Main chess game interface
│   │   ├── PostGameChatView.swift  # Post-game analysis chat
│   │   └── SettingsView.swift      # API key configuration
│   ├── Services/
│   │   ├── OpenAIService.swift     # OpenAI API integration
│   │   └── ChessEngineService.swift # Chess engine utilities
│   ├── Utils/
│   │   └── ChessUtilities.swift    # Helper functions and extensions
│   └── Assets.xcassets/            # App icons and assets
└── ChessChat.xcodeproj/            # Xcode project configuration
```

## Technical Implementation

### Architecture
- **SwiftUI**: All UI components built with SwiftUI
- **MVVM Pattern**: Clear separation of concerns
- **ObservableObject**: Reactive state management
- **Async/Await**: Modern concurrency for API calls

### Chess Engine
- **Legal Move Validation**: Complete implementation of chess rules
- **FEN Generation**: Standard chess position notation
- **PGN Export**: Portable game notation for move history
- **Game State Detection**: Checkmate, stalemate, and draw conditions

### AI Integration
- **OpenAI GPT-4o-mini**: Powers the AI opponent
- **UCI Move Format**: Standard chess move notation
- **Context-Aware Chat**: Post-game analysis with full game context
- **Error Handling**: Robust API error management and retry logic

## Setup Instructions

### Prerequisites
1. **Xcode 15.0+** with iOS 17.0+ SDK
2. **OpenAI API Key** from [platform.openai.com](https://platform.openai.com/api-keys)
3. **iOS Device or Simulator** running iOS 17.0+

### Installation Steps

1. **Clone/Download the Project**
   ```bash
   # Navigate to the ChessChat directory
   cd "C:\Users\richl\LLM vs Me\ChessChat"
   ```

2. **Open in Xcode**
   - Open `ChessChat.xcodeproj` in Xcode
   - Wait for Xcode to finish indexing

3. **Configure Build Settings**
   - Select your development team in Project Settings > Signing & Capabilities
   - Ensure bundle identifier is unique (e.g., `com.yourname.chesschat`)

4. **Build and Run**
   - Select your target device/simulator
   - Press `Cmd+R` to build and run

### API Key Setup

1. **Get OpenAI API Key**
   - Go to [platform.openai.com](https://platform.openai.com/api-keys)
   - Sign up or log in to your account
   - Navigate to "API Keys"
   - Create a new secret key
   - Copy the key (you won't be able to see it again!)

2. **Configure in App**
   - Launch the app
   - Tap "Settings" in the top-right corner
   - Paste your API key in the "API Key" field
   - Tap "Save"

## How to Test

### Basic Chess Gameplay

1. **Start a New Game**
   - Launch the app
   - The chess board appears with pieces in starting position
   - White (you) moves first

2. **Make Moves**
   - Tap a white piece to select it (piece will be highlighted in blue)
   - Tap the destination square to move
   - Invalid moves will be rejected
   - The AI will think and respond with its move

3. **Game Controls**
   - **New Game**: Resets the board and starts over
   - **Settings**: Configure your OpenAI API key

### Testing AI Opponent

1. **Make Opening Moves**
   - Try standard openings like e2-e4 or d2-d4
   - The AI should respond with reasonable opening moves
   - Moves should appear within 3-10 seconds

2. **Verify Legal Moves**
   - The AI should only make legal moves
   - If an illegal move is attempted, the app will show an error and request a new move

3. **Game Progression**
   - Play several moves to test the AI's chess understanding
   - The AI should make strategically reasonable moves

### Testing Post-Game Chat

1. **Finish a Game**
   - Play until checkmate, stalemate, or resignation
   - An alert will appear offering "New Game" or "Analyze Game"
   - Select "Analyze Game"

2. **Chat Interface**
   - The post-game chat screen displays game results and PGN
   - Ask questions about the game:
     - "Where did I make mistakes?"
     - "Explain move 12"
     - "What are better alternatives to my 8th move?"
     - "How could I have won this game?"

3. **AI Responses**
   - The AI should provide detailed analysis
   - Responses should reference specific moves and positions
   - Analysis should be educational and helpful

### Testing Error Scenarios

1. **No API Key**
   - Remove the API key from settings
   - Try to make a move against the AI
   - Should show clear error message about missing API key

2. **Invalid API Key**
   - Enter an invalid API key
   - Try to make a move
   - Should show authentication error

3. **Network Issues**
   - Turn off internet connection
   - Try to make a move
   - Should show network error message

## Usage Tips

### For Players
- **Take Your Time**: There's no time limit, so think through your moves
- **Learn from Mistakes**: Use the post-game chat to understand your errors
- **Ask Specific Questions**: The AI can explain specific moves, tactics, and strategies
- **Experiment**: Try different openings and see how the AI responds

### For Developers
- **Customize AI Behavior**: Modify the prompts in `OpenAIService.swift` to change AI personality
- **Add Features**: The modular structure makes it easy to add new features
- **Improve Chess Engine**: Enhance move validation or add advanced features like en passant
- **UI Enhancements**: The SwiftUI views are easy to modify and extend

## Troubleshooting

### Common Issues

1. **App Won't Build**
   - Check Xcode version (15.0+ required)
   - Verify iOS deployment target (17.0+)
   - Clean build folder (Product > Clean Build Folder)

2. **AI Not Responding**
   - Verify API key is correctly entered
   - Check internet connection
   - Look for error messages in the app

3. **Moves Not Working**
   - Ensure you're selecting your own pieces (white)
   - Check that the destination square is a legal move
   - Try selecting a different piece

4. **Chat Not Working**
   - Verify API key is set
   - Check that game has ended (you must finish a game first)
   - Look for error messages

### Error Messages

- **"OpenAI API key not set"**: Go to Settings and add your API key
- **"Network connection error"**: Check your internet connection
- **"Invalid AI move format"**: The AI returned an invalid move (rare, will retry automatically)
- **"API quota exceeded"**: Your OpenAI account has reached its usage limit

## Future Enhancements (Not in Phase 1)

- Multiple difficulty levels
- Different AI personalities  
- Game replay and analysis
- Online multiplayer
- Chess puzzles and training
- Tournament mode
- Themes and customization
- Sound effects and animations

## API Costs

OpenAI API usage is charged to your account:
- **GPT-4o-mini**: ~$0.00015 per 1K tokens
- **Typical game**: 20-40 moves ≈ $0.01-0.03
- **Chat analysis**: Variable, typically $0.005-0.02 per question

For detailed pricing, visit [openai.com/pricing](https://openai.com/pricing).

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify your OpenAI API key is valid and has credits
3. Ensure you're running iOS 17.0+ and Xcode 15.0+

---

**ChessChat v1.0** - A simple, elegant chess experience with AI analysis.