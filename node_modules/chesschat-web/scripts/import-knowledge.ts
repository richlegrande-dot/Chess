/**
 * Knowledge Import Script
 * 
 * Imports markdown files from knowledge_seed/ directory into the Knowledge Vault.
 * Implements intelligent chunking algorithm:
 * - Split by ## headings first
 * - Then split paragraphs if sections too large
 * - Target chunk size: 400-1200 characters
 * - Extract tags from headings
 * - Preserve context with heading prefixes
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient().$extends(withAccelerate());

interface ChunkData {
  chunkText: string;
  tags: string;
  language: string;
  metadata: string;
}

interface ImportStats {
  sourcesCreated: number;
  chunksCreated: number;
  filesProcessed: number;
  errors: string[];
}

/**
 * Parse markdown content and split into chunks
 */
function parseMarkdownIntoChunks(content: string, filename: string): ChunkData[] {
  const chunks: ChunkData[] = [];
  
  // Split by ## headings (H2)
  const sections = content.split(/\n##\s+/);
  const title = sections[0].trim(); // First section is title (# heading)
  
  // Process each section
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.split('\n');
    const heading = lines[0].trim();
    const sectionContent = lines.slice(1).join('\n').trim();
    
    // Extract tags from heading
    const tags = extractTags(heading);
    
    // If section is small enough, keep it as one chunk
    if (sectionContent.length <= 1200) {
      chunks.push({
        chunkText: `## ${heading}\n\n${sectionContent}`,
        tags: JSON.stringify(tags),
        language: 'en',
        metadata: JSON.stringify({
          heading,
          section: i,
          source: filename,
        }),
      });
    } else {
      // Split large sections by paragraphs
      const paragraphs = sectionContent.split(/\n\n+/);
      let currentChunk = '';
      let chunkCount = 0;
      
      for (const paragraph of paragraphs) {
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) continue;
        
        // If adding this paragraph exceeds max size, save current chunk and start new
        if (currentChunk.length + trimmedParagraph.length + 2 > 1200 && currentChunk.length > 400) {
          chunks.push({
            chunkText: `## ${heading}\n\n${currentChunk.trim()}`,
            tags: JSON.stringify(tags),
            language: 'en',
            metadata: JSON.stringify({
              heading,
              section: i,
              part: ++chunkCount,
              source: filename,
            }),
          });
          currentChunk = '';
        }
        
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
      }
      
      // Add remaining content
      if (currentChunk.trim()) {
        chunks.push({
          chunkText: `## ${heading}\n\n${currentChunk.trim()}`,
          tags: JSON.stringify(tags),
          language: 'en',
          metadata: JSON.stringify({
            heading,
            section: i,
            part: chunkCount > 0 ? ++chunkCount : undefined,
            source: filename,
          }),
        });
      }
    }
  }
  
  return chunks;
}

/**
 * Extract tags from heading text
 */
function extractTags(heading: string): string[] {
  const tags: string[] = [];
  
  // Common chess terms that should be tags
  const keywords = [
    'tactics', 'pin', 'fork', 'skewer', 'discovered', 'deflection', 'overloading',
    'opening', 'center', 'development', 'castling', 'king safety',
    'endgame', 'pawn', 'rook', 'bishop', 'knight', 'queen', 'king',
    'checkmate', 'opposition', 'zugzwang', 'breakthrough',
    'lucena', 'philidor', 'study', 'technique', 'strategy'
  ];
  
  const lowerHeading = heading.toLowerCase();
  
  for (const keyword of keywords) {
    if (lowerHeading.includes(keyword)) {
      tags.push(keyword);
    }
  }
  
  // Add the heading itself as a tag (normalized)
  const normalizedHeading = heading
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 30);
  
  if (normalizedHeading) {
    tags.push(normalizedHeading);
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Import a single markdown file
 */
async function importMarkdownFile(filePath: string, stats: ImportStats): Promise<void> {
  try {
    console.log(`\n📄 Processing: ${path.basename(filePath)}`);
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extract title from first line (# Title)
    const titleMatch = content.match(/^#\s+(.+?)$/m);
    const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md');
    
    console.log(`   Title: ${title}`);
    
    // Parse into chunks
    const chunks = parseMarkdownIntoChunks(content, path.basename(filePath));
    console.log(`   Generated ${chunks.length} chunks`);
    
    // Create source in database
    const source = await prisma.knowledgeSource.create({
      data: {
        title,
        sourceType: 'DOC',
        url: `file://knowledge_seed/${path.basename(filePath)}`,
        isDeleted: false,
      },
    });
    
    console.log(`   ✅ Created source: ${source.id}`);
    stats.sourcesCreated++;
    
    // Create chunks in database
    let chunkCount = 0;
    for (const chunkData of chunks) {
      await prisma.knowledgeChunk.create({
        data: {
          sourceId: source.id,
          ...chunkData,
        },
      });
      chunkCount++;
    }
    
    console.log(`   ✅ Created ${chunkCount} chunks`);
    stats.chunksCreated += chunkCount;
    stats.filesProcessed++;
    
    // Log to audit trail
    await prisma.knowledgeEditLog.create({
      data: {
        actor: 'import-script',
        action: 'CREATE',
        entityType: 'source',
        entityId: source.id,
        beforeJson: null,
        afterJson: JSON.stringify({ title, chunkCount }),
      },
    });
    
  } catch (error) {
    const errorMsg = `Failed to import ${path.basename(filePath)}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`   ❌ ${errorMsg}`);
    stats.errors.push(errorMsg);
  }
}

/**
 * Main import function
 */
async function importKnowledge() {
  console.log('🚀 Starting Knowledge Import...\n');
  
  const stats: ImportStats = {
    sourcesCreated: 0,
    chunksCreated: 0,
    filesProcessed: 0,
    errors: [],
  };
  
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✅ Database connected\n');
    
    // Get knowledge_seed directory
    const seedDir = path.join(__dirname, '..', 'knowledge_seed');
    
    if (!fs.existsSync(seedDir)) {
      throw new Error(`Knowledge seed directory not found: ${seedDir}`);
    }
    
    // Get all .md files
    const files = fs.readdirSync(seedDir)
      .filter(f => f.endsWith('.md'))
      .sort(); // Process in order
    
    console.log(`📚 Found ${files.length} markdown files\n`);
    
    // Import each file
    for (const file of files) {
      const filePath = path.join(seedDir, file);
      await importMarkdownFile(filePath, stats);
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Import Summary');
    console.log('='.repeat(50));
    console.log(`Files processed:   ${stats.filesProcessed}/${files.length}`);
    console.log(`Sources created:   ${stats.sourcesCreated}`);
    console.log(`Chunks created:    ${stats.chunksCreated}`);
    console.log(`Average chunks:    ${stats.sourcesCreated > 0 ? (stats.chunksCreated / stats.sourcesCreated).toFixed(1) : 0}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`);
      stats.errors.forEach(err => console.log(`   - ${err}`));
    } else {
      console.log(`\n✅ All files imported successfully!`);
    }
    
    // Run diagnostics
    console.log('\n🔍 Running chunk count diagnostics...');
    const sources = await prisma.knowledgeSource.findMany({
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });
    
    console.log('\n📈 Chunk count per source:');
    for (const source of sources) {
      console.log(`   ${source.title}: ${source._count.chunks} chunks`);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Import complete!\n');
  }
}

// Run import
importKnowledge().catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});

export { parseMarkdownIntoChunks, extractTags };
