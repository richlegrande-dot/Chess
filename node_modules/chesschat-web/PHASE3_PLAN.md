# Phase 3: Custom LLM Training Infrastructure

**Status:** Planning Complete - Ready to Begin
**Date:** December 19, 2025
**Prerequisites:** Phase 2 Complete ✅

---

## Overview

Phase 3 focuses on building the infrastructure and tooling needed to train a custom language model for chess coaching. Since training requires 500-1,000 games of data, we'll build the training pipeline now while data collection happens in the background.

---

## Phase 3A: Training Pipeline Setup (Immediate)

### 1. Python Training Environment 🐍

**Goal:** Set up Python environment for model training

**Tasks:**
- [ ] Create `training/` directory in project root
- [ ] Create `requirements.txt` with dependencies:
  - `torch` or `transformers` (Hugging Face)
  - `datasets` for data loading
  - `onnxruntime` for model export
  - `numpy`, `pandas` for data processing
- [ ] Create Python virtual environment setup script
- [ ] Test environment installation

**Files to Create:**
```
training/
├── requirements.txt
├── setup.py
├── README.md
└── scripts/
    └── setup_env.ps1
```

---

### 2. Data Processing Pipeline 📊

**Goal:** Convert JSONL training data to model-ready format

**Tasks:**
- [ ] Create `data_processor.py`:
  - Load JSONL from ChessChatWeb export
  - Tokenize prompts and completions
  - Create train/validation split (80/20)
  - Generate statistics and quality metrics
- [ ] Create `data_validator.py`:
  - Check for duplicate examples
  - Validate prompt/completion format
  - Calculate dataset diversity metrics
  - Flag low-quality examples

**Expected Input Format:**
```jsonl
{"prompt":"You are a chess coach...\nPlayer Level: 5/10...","completion":"## Top Improvements\n1. **Protect Your Pieces**...","metadata":{...}}
```

**Expected Output:**
- `train.jsonl` (80% of data)
- `val.jsonl` (20% of data)
- `dataset_stats.json` (quality metrics)

---

### 3. Model Selection & Configuration ⚙️

**Goal:** Choose and configure the base model for fine-tuning

**Options:**

#### Option A: GPT-2 Small (124M parameters) - RECOMMENDED
**Pros:**
- Fast training (<1 hour on CPU for 500 examples)
- Small model size (~500MB)
- Easy browser deployment with ONNX
- Good text generation quality

**Cons:**
- Limited context window (1024 tokens)
- May struggle with long game analyses

**Training Time:** ~30-60 minutes on modern CPU
**Inference Speed:** ~100ms per response in browser

#### Option B: GPT-2 Medium (355M parameters)
**Pros:**
- Better text quality
- Larger capacity

**Cons:**
- Slower training (2-3 hours)
- Larger model (~1.4GB)
- Slower browser inference

#### Option C: DistilGPT-2 (82M parameters)
**Pros:**
- Fastest training (~20 minutes)
- Smallest size (~330MB)
- Fastest browser inference

**Cons:**
- Lower quality outputs
- Less context understanding

**Recommendation:** Start with GPT-2 Small for best balance

---

### 4. Training Script 🚂

**Goal:** Implement fine-tuning pipeline

**File:** `training/scripts/train_model.py`

**Features:**
- Load pre-trained GPT-2 from Hugging Face
- Fine-tune on chess coaching data
- Track training metrics (loss, perplexity)
- Save checkpoints every N steps
- Early stopping if validation loss increases
- Generate sample outputs during training

**Hyperparameters:**
```python
BATCH_SIZE = 4
LEARNING_RATE = 5e-5
EPOCHS = 3-5
MAX_LENGTH = 512
WARMUP_STEPS = 100
```

**Training Loop:**
1. Load tokenizer and model
2. Prepare datasets
3. Configure trainer
4. Train for N epochs
5. Evaluate on validation set
6. Save best model checkpoint

---

### 5. Model Export to ONNX 📦

**Goal:** Convert trained model to browser-compatible format

**File:** `training/scripts/export_to_onnx.py`

**Steps:**
1. Load trained PyTorch model
2. Convert to ONNX format
3. Optimize for inference (quantization)
4. Test ONNX model generates valid outputs
5. Package with tokenizer

**Output:**
```
models/
├── chess_coach_gpt2.onnx     # Main model (500MB)
├── tokenizer.json             # Tokenizer config
├── vocab.json                 # Vocabulary
└── model_config.json          # Model metadata
```

---

## Phase 3B: Browser Integration (After Training)

### 6. ONNX Runtime Integration 🌐

**Goal:** Load and run ONNX model in browser

**Tasks:**
- [ ] Install `onnxruntime-web` npm package
- [ ] Create `src/lib/onnxInference.ts`:
  - Load ONNX model from public folder
  - Initialize ONNX session
  - Tokenize input text
  - Run inference
  - Decode output tokens
- [ ] Add loading progress indicator
- [ ] Implement model caching (IndexedDB)
- [ ] Add fallback to rule-based if model fails

**File:** `src/lib/onnxInference.ts`
```typescript
export class ChessCoachLLM {
  private session: InferenceSession | null = null;
  private tokenizer: Tokenizer;
  
  async load(progressCallback?: (progress: number) => void): Promise<void>
  async generate(prompt: string, maxTokens: number): Promise<string>
  async unload(): Promise<void>
}
```

---

### 7. Hybrid Coaching System 🔀

**Goal:** Combine rule-based structure with LLM natural language

**Architecture:**
```
User plays game
    ↓
Rule-based analyzer (Phase 1)
    ├─ Tactical analysis
    ├─ Strategic analysis
    └─ Identify top issues
    ↓
Structured coaching report
    ↓
Custom LLM (Phase 3)
    ├─ Converts report to natural language
    ├─ Adds personalized explanations
    └─ Maintains encouraging tone
    ↓
Final coaching feedback
```

**Implementation:**
- Rule-based provides:
  - Tactical mistakes (blunders, hanging pieces)
  - Strategic violations (development, king safety)
  - Quantitative metrics
  - Game phase analysis
  
- Custom LLM provides:
  - Natural conversational tone
  - Personalized explanations
  - Context-aware advice
  - Encouraging language

**File:** `src/lib/coaching/hybridCoachingEngine.ts`
```typescript
export class HybridCoachingEngine {
  constructor(
    private ruleEngine: RuleBasedCoachingEngine,
    private llm: ChessCoachLLM | null
  ) {}
  
  async analyzeGame(moveHistory, playerColor, gameContext) {
    // Step 1: Rule-based analysis (fast, reliable)
    const ruleReport = await this.ruleEngine.analyzeGame(...)
    
    // Step 2: LLM enhancement (optional, natural language)
    if (this.llm) {
      return await this.enhanceWithLLM(ruleReport)
    }
    
    // Fallback: Return rule-based report
    return ruleReport
  }
  
  private async enhanceWithLLM(ruleReport: CoachingReport) {
    const prompt = this.formatRuleReportAsPrompt(ruleReport)
    const llmResponse = await this.llm.generate(prompt, 500)
    return this.mergeReports(ruleReport, llmResponse)
  }
}
```

---

## Phase 3C: Testing & Optimization

### 8. Model Quality Testing 🧪

**Goal:** Verify model generates good coaching

**Tests:**
- [ ] Generate coaching for 10 known games
- [ ] Compare LLM output vs rule-based templates
- [ ] Check for:
  - Factual accuracy (no hallucinations)
  - Appropriate tone (encouraging, not harsh)
  - Actionable advice
  - Correct chess terminology
- [ ] User feedback collection

**File:** `training/scripts/evaluate_quality.py`

---

### 9. Performance Optimization ⚡

**Goal:** Ensure fast inference in browser

**Optimizations:**
- [ ] Model quantization (INT8 instead of FP32)
- [ ] Reduce max token generation (200 instead of 500)
- [ ] Implement streaming generation
- [ ] Cache common responses
- [ ] Use Web Workers for inference

**Target Performance:**
- Model loading: <10 seconds
- Inference time: <2 seconds per response
- Memory usage: <1GB RAM

---

## Timeline & Milestones

### Week 1: Infrastructure Setup
- ✅ Phase 1 complete (rule-based coaching)
- ✅ Phase 2 complete (training data collection)
- ⏳ **Day 1:** Set up Python environment
- ⏳ **Day 2:** Create data processing pipeline
- ⏳ **Day 3:** Test with sample data

### Week 2: Model Training (Waiting for Data)
- **Target:** Collect 100+ games
- Continue playing coaching mode
- Monitor data quality
- Adjust templates if needed

### Week 3: Model Training (Ready)
- **Target:** 500+ games collected
- Train GPT-2 Small
- Evaluate on validation set
- Export to ONNX

### Week 4: Browser Integration
- Install onnxruntime-web
- Implement browser inference
- Build hybrid coaching system
- Test end-to-end

### Week 5: Testing & Polish
- Quality testing
- Performance optimization
- User feedback
- Production deployment

---

## Technical Requirements

### Development Machine
- **CPU:** Modern multi-core (Intel i5/i7 or AMD Ryzen)
- **RAM:** 16GB+ recommended
- **Storage:** 10GB free space
- **GPU:** Optional (CUDA for faster training)

### Software Dependencies
- Python 3.9+
- Node.js 18+ (already installed)
- PyTorch or Transformers library
- ONNX Runtime

### Browser Requirements
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- 4GB+ RAM available

---

## Data Collection Goals

### Current Status
- Training examples collected: **0** (just started)
- Target for training: **500-1,000 examples**

### Collection Strategy
1. **Week 1:** Play 50 games (10 per day)
2. **Week 2:** Play 100 more games
3. **Week 3:** Reach 500 games minimum
4. **Optional:** Collect up to 1,000 for better quality

### Data Quality Checklist
- [ ] Games from different skill levels (beginner → intermediate)
- [ ] Games with different openings (e4, d4, Nf3, c4, etc.)
- [ ] Games with various tactical patterns (forks, pins, skewers)
- [ ] Games with endgames (not just early resignations)
- [ ] Balanced color distribution (50% white, 50% black)

---

## Risk Mitigation

### Risk: Not Enough Training Data
**Mitigation:** 
- Start with 100 games, train prototype
- Collect more data over time
- Retrain model as data grows

### Risk: Model Quality Poor
**Mitigation:**
- Hybrid approach ensures rule-based fallback
- Fine-tune hyperparameters
- Try different base models
- Add more diverse training examples

### Risk: Browser Performance
**Mitigation:**
- Use model quantization
- Implement Web Workers
- Add "Lite Mode" without LLM
- Progressive enhancement

### Risk: Model Too Large
**Mitigation:**
- Start with GPT-2 Small (500MB)
- Consider DistilGPT-2 (330MB)
- Use compression techniques
- Lazy loading (download on first use)

---

## Success Criteria

### Phase 3A: Training Pipeline
✅ Python environment set up and working
✅ Data processor converts JSONL → training format
✅ Model trains without errors
✅ Validation loss decreases over epochs
✅ Model generates chess-related text
✅ ONNX export successful

### Phase 3B: Browser Integration
✅ Model loads in browser (<10 seconds)
✅ Inference completes in <3 seconds
✅ Generated text is coherent
✅ No browser crashes or memory leaks
✅ Fallback to rule-based works

### Phase 3C: Quality
✅ 80%+ of generated coaching is useful
✅ No factual hallucinations
✅ Tone is encouraging and supportive
✅ Users prefer LLM version over templates
✅ Performance acceptable on average hardware

---

## Next Steps (Immediate)

### Option A: Start Training Infrastructure (Recommended)
Build the training pipeline now while data collection continues:
1. Create `training/` directory structure
2. Set up Python environment
3. Create data processor
4. Test with mock data
5. Prepare for real training once 100+ games collected

**Why this approach:**
- Makes productive use of time
- Can test pipeline with sample data
- Ready to train immediately when data available
- No waiting around

### Option B: Focus on Data Collection
Continue refining the coaching system:
1. Play many games to collect data faster
2. Enhance rule-based templates
3. Add more tactical patterns
4. Improve strategic analysis
5. Wait until 500 games, then build training

**Why this approach:**
- Simpler, more linear
- Ensure high-quality training data
- Refine coaching before training

### Option C: Parallel Development
Do both simultaneously:
1. Build training infrastructure
2. Play games daily to collect data
3. Test pipeline with sample/synthetic data
4. Train prototype with 100 games
5. Retrain with full dataset later

**Why this approach:**
- Fastest path to completion
- Iterate quickly with prototypes
- Learn what works best early

---

## Recommendation: Option A (Start Training Infrastructure)

**Rationale:**
- Training infrastructure takes time to build properly
- Can test everything with sample data
- Ready to train the moment we hit 100+ games
- Makes efficient use of development time
- Reduces risk by testing early

**First Implementation Steps:**
1. Create `training/` directory structure
2. Write `requirements.txt`
3. Create Python environment setup script
4. Build data processor for JSONL
5. Test with 10-20 synthetic examples
6. Set up training script skeleton
7. Test ONNX export with pre-trained GPT-2

**Estimated Time:** 4-6 hours of development

Would you like to start Phase 3A now?
