"""
Data Processing Pipeline for Chess Coach Training

Processes JSONL training data exported from ChessChatWeb:
1. Loads raw JSONL file
2. Validates format and quality
3. Creates train/validation split (80/20)
4. Generates statistics
5. Saves processed datasets

Usage:
    python process_data.py --input data/raw/training_data.jsonl --output data/processed/
    python process_data.py --input data/raw/training_data.jsonl --stats-only
"""

import json
import argparse
from pathlib import Path
from typing import List, Dict, Any
from collections import Counter
import random


def load_jsonl(filepath: Path) -> List[Dict[str, Any]]:
    """Load JSONL file and return list of examples."""
    examples = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            try:
                example = json.loads(line.strip())
                examples.append(example)
            except json.JSONDecodeError as e:
                print(f"⚠️  Warning: Skipping invalid JSON on line {line_num}: {e}")
    return examples


def validate_example(example: Dict[str, Any], index: int) -> bool:
    """Validate that example has required fields and format."""
    required_fields = ['prompt', 'completion', 'metadata']
    
    for field in required_fields:
        if field not in example:
            print(f"⚠️  Warning: Example {index} missing field '{field}'")
            return False
    
    if not isinstance(example['prompt'], str) or len(example['prompt']) < 10:
        print(f"⚠️  Warning: Example {index} has invalid prompt")
        return False
    
    if not isinstance(example['completion'], str) or len(example['completion']) < 10:
        print(f"⚠️  Warning: Example {index} has invalid completion")
        return False
    
    return True


def calculate_statistics(examples: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate dataset statistics."""
    
    # Basic counts
    total_examples = len(examples)
    
    # Token counts (rough estimate: ~4 chars per token)
    prompt_lengths = [len(ex['prompt']) // 4 for ex in examples]
    completion_lengths = [len(ex['completion']) // 4 for ex in examples]
    
    # Extract metadata statistics
    player_levels = []
    move_counts = []
    blunders = []
    mistakes = []
    colors = []
    
    for ex in examples:
        metadata = ex.get('metadata', {})
        if 'playerLevel' in metadata:
            player_levels.append(metadata['playerLevel'])
        if 'moveCount' in metadata:
            move_counts.append(metadata['moveCount'])
        if 'blunders' in metadata:
            blunders.append(metadata['blunders'])
        if 'mistakes' in metadata:
            mistakes.append(metadata['mistakes'])
        if 'playerColor' in metadata:
            colors.append(metadata['playerColor'])
    
    stats = {
        'total_examples': total_examples,
        'prompts': {
            'avg_tokens': sum(prompt_lengths) // len(prompt_lengths) if prompt_lengths else 0,
            'min_tokens': min(prompt_lengths) if prompt_lengths else 0,
            'max_tokens': max(prompt_lengths) if prompt_lengths else 0,
        },
        'completions': {
            'avg_tokens': sum(completion_lengths) // len(completion_lengths) if completion_lengths else 0,
            'min_tokens': min(completion_lengths) if completion_lengths else 0,
            'max_tokens': max(completion_lengths) if completion_lengths else 0,
        },
        'player_levels': {
            'avg': sum(player_levels) / len(player_levels) if player_levels else 0,
            'distribution': dict(Counter(player_levels))
        },
        'game_stats': {
            'avg_moves': sum(move_counts) / len(move_counts) if move_counts else 0,
            'avg_blunders': sum(blunders) / len(blunders) if blunders else 0,
            'avg_mistakes': sum(mistakes) / len(mistakes) if mistakes else 0,
        },
        'color_distribution': dict(Counter(colors))
    }
    
    return stats


def split_dataset(examples: List[Dict[str, Any]], train_ratio: float = 0.8) -> tuple:
    """Split dataset into train and validation sets."""
    random.shuffle(examples)
    split_index = int(len(examples) * train_ratio)
    return examples[:split_index], examples[split_index:]


def save_jsonl(examples: List[Dict[str, Any]], filepath: Path):
    """Save examples to JSONL file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        for example in examples:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')


def print_statistics(stats: Dict[str, Any]):
    """Print formatted statistics."""
    print("\n" + "="*60)
    print("📊 Dataset Statistics")
    print("="*60)
    
    print(f"\n📝 Total Examples: {stats['total_examples']}")
    
    print(f"\n💬 Prompts:")
    print(f"  Average tokens: {stats['prompts']['avg_tokens']}")
    print(f"  Range: {stats['prompts']['min_tokens']} - {stats['prompts']['max_tokens']}")
    
    print(f"\n✅ Completions:")
    print(f"  Average tokens: {stats['completions']['avg_tokens']}")
    print(f"  Range: {stats['completions']['min_tokens']} - {stats['completions']['max_tokens']}")
    
    print(f"\n🎯 Player Levels:")
    print(f"  Average: {stats['player_levels']['avg']:.1f}/10")
    print(f"  Distribution: {stats['player_levels']['distribution']}")
    
    print(f"\n♟️  Game Statistics:")
    print(f"  Average moves: {stats['game_stats']['avg_moves']:.1f}")
    print(f"  Average blunders: {stats['game_stats']['avg_blunders']:.2f}")
    print(f"  Average mistakes: {stats['game_stats']['avg_mistakes']:.2f}")
    
    print(f"\n⚫⚪ Color Distribution:")
    print(f"  {stats['color_distribution']}")
    
    print("\n" + "="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(description='Process chess coaching training data')
    parser.add_argument('--input', type=str, required=True, help='Input JSONL file path')
    parser.add_argument('--output', type=str, default='data/processed/', help='Output directory')
    parser.add_argument('--train-ratio', type=float, default=0.8, help='Train/val split ratio (default: 0.8)')
    parser.add_argument('--stats-only', action='store_true', help='Only show statistics, don\'t process')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility')
    
    args = parser.parse_args()
    
    # Set random seed
    random.seed(args.seed)
    
    # Load data
    print(f"📂 Loading data from: {args.input}")
    input_path = Path(args.input)
    
    if not input_path.exists():
        print(f"❌ Error: File not found: {args.input}")
        return
    
    examples = load_jsonl(input_path)
    print(f"✅ Loaded {len(examples)} examples")
    
    # Validate examples
    print("\n🔍 Validating examples...")
    valid_examples = []
    for i, example in enumerate(examples):
        if validate_example(example, i):
            valid_examples.append(example)
    
    print(f"✅ {len(valid_examples)}/{len(examples)} examples are valid")
    
    if len(valid_examples) == 0:
        print("❌ No valid examples found")
        return
    
    # Calculate and print statistics
    stats = calculate_statistics(valid_examples)
    print_statistics(stats)
    
    # Check if we have enough data
    if len(valid_examples) < 100:
        print(f"⚠️  Warning: Only {len(valid_examples)} examples. Recommended minimum: 500")
        print("   Continue playing coaching mode to collect more data.")
    
    # If stats-only, stop here
    if args.stats_only:
        return
    
    # Split dataset
    print(f"✂️  Splitting dataset ({args.train_ratio:.0%} train, {1-args.train_ratio:.0%} val)...")
    train_examples, val_examples = split_dataset(valid_examples, args.train_ratio)
    print(f"✅ Train: {len(train_examples)} examples")
    print(f"✅ Val: {len(val_examples)} examples")
    
    # Create output directory
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save processed datasets
    print(f"\n💾 Saving processed datasets to: {output_dir}")
    
    train_path = output_dir / 'train.jsonl'
    val_path = output_dir / 'val.jsonl'
    stats_path = output_dir / 'stats.json'
    
    save_jsonl(train_examples, train_path)
    print(f"✅ Saved: {train_path}")
    
    save_jsonl(val_examples, val_path)
    print(f"✅ Saved: {val_path}")
    
    # Add split info to stats
    stats['splits'] = {
        'train': len(train_examples),
        'validation': len(val_examples),
        'train_ratio': args.train_ratio
    }
    
    with open(stats_path, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved: {stats_path}")
    
    print("\n🎉 Data processing complete!")
    print("\nNext steps:")
    print(f"  python scripts/train_model.py --train {train_path} --val {val_path}")


if __name__ == '__main__':
    main()
