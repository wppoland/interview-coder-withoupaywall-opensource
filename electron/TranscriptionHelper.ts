// TranscriptionHelper.ts
import { IProcessingHelperDeps } from "./main"
import { OpenAI } from "openai"
import { configHelper } from "./ConfigHelper"
import Anthropic from '@anthropic-ai/sdk';
import * as axios from "axios"

export class TranscriptionHelper {
  private deps: IProcessingHelperDeps
  private openaiClient: OpenAI | null = null
  private anthropicClient: Anthropic | null = null
  private geminiApiKey: string | null = null
  private transcript: string = ""
  private isListening: boolean = false

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.initializeAIClient()
    
    // Listen for config changes to re-initialize the AI client
    configHelper.on('config-updated', () => {
      this.initializeAIClient()
    })
  }

  private initializeAIClient(): void {
    try {
      const config = configHelper.loadConfig()
      
      if (config.apiProvider === "openai") {
        if (config.apiKey) {
          this.openaiClient = new OpenAI({ 
            apiKey: config.apiKey,
            timeout: 60000,
            maxRetries: 2
          })
          this.geminiApiKey = null
          this.anthropicClient = null
          console.log("OpenAI client initialized for transcription")
        } else {
          this.openaiClient = null
          this.geminiApiKey = null
          this.anthropicClient = null
          console.warn("No API key available for transcription")
        }
      } else if (config.apiProvider === "gemini") {
        this.openaiClient = null
        this.anthropicClient = null
        if (config.apiKey) {
          this.geminiApiKey = config.apiKey
          console.log("Gemini API key set for transcription")
        } else {
          this.geminiApiKey = null
          console.warn("No API key available for transcription")
        }
      } else if (config.apiProvider === "anthropic") {
        this.openaiClient = null
        this.geminiApiKey = null
        if (config.apiKey) {
          this.anthropicClient = new Anthropic({
            apiKey: config.apiKey,
            timeout: 60000,
            maxRetries: 2
          })
          console.log("Anthropic client initialized for transcription")
        } else {
          this.anthropicClient = null
          console.warn("No API key available for transcription")
        }
      }
    } catch (error) {
      console.error("Failed to initialize AI client for transcription:", error)
      this.openaiClient = null
      this.geminiApiKey = null
      this.anthropicClient = null
    }
  }

  public getTranscript(): string {
    return this.transcript
  }

  public appendToTranscript(text: string): void {
    this.transcript += (this.transcript ? " " : "") + text
    console.log("Transcript updated:", this.transcript.substring(0, 100) + "...")
  }

  public clearTranscript(): void {
    this.transcript = ""
    console.log("Transcript cleared")
  }

  public setIsListening(isListening: boolean): void {
    this.isListening = isListening
  }

  public getIsListening(): boolean {
    return this.isListening
  }

  /**
   * Extract the question from the transcript
   * Looks for the most recent question mark or question-like pattern
   * Supports both English and Polish question words
   */
  private extractQuestion(transcript: string): string | null {
    if (!transcript || transcript.trim().length === 0) {
      return null
    }

    // Split by sentences and look for the last question
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    // English question words
    const englishQuestionWords = /^(what|where|when|who|why|how|can|could|would|should|is|are|do|does|did|will|have|has|tell|explain|describe)/i
    
    // Polish question words
    const polishQuestionWords = /^(co|gdzie|kiedy|kto|dlaczego|jak|czy|możesz|mógłbyś|powiedz|wyjaśnij|opisz|czym|jaki|jaka|jakie|jakich|jakim)/i
    
    // Look for the last sentence ending with a question mark
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i].trim()
      // Check if it's a question (ends with ? or contains question words in English or Polish)
      if (sentence.includes("?") || 
          englishQuestionWords.test(sentence) ||
          polishQuestionWords.test(sentence)) {
        // Get context - include a few sentences before for better context
        const startIndex = Math.max(0, i - 2)
        const questionText = sentences.slice(startIndex, i + 1).join(". ").trim()
        return questionText + (questionText.endsWith("?") ? "" : "?")
      }
    }

    // If no clear question found, return the last few sentences
    if (sentences.length > 0) {
      const lastFew = sentences.slice(-3).join(". ").trim()
      return lastFew + (lastFew.endsWith("?") ? "" : "?")
    }

    return transcript
  }

  /**
   * Generate a reply to the question in the transcript using AI
   */
  public async replyToQuestion(): Promise<string> {
    const question = this.extractQuestion(this.transcript)
    
    if (!question) {
      throw new Error("No question found in transcript")
    }

    console.log("Extracted question:", question)
    
    const config = configHelper.loadConfig()
    const model = config.solutionModel || "gpt-4o-mini"
    const transcriptionLang = config.transcriptionLanguage || "en-US"
    
    // Determine response language based on transcription language
    const isPolish = transcriptionLang === "pl-PL"
    const systemPrompt = isPolish 
      ? "Jesteś pomocnym asystentem odpowiadającym na pytania rekrutacyjne. Udzielaj jasnych, zwięzłych i dokładnych odpowiedzi po polsku."
      : "You are a helpful assistant answering interview questions. Provide clear, concise, and accurate answers."

    try {
      if (config.apiProvider === "openai" && this.openaiClient) {
        const response = await this.openaiClient.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: question
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        })

        const answer = response.choices[0]?.message?.content || "No answer generated"
        console.log("Generated answer:", answer.substring(0, 100) + "...")
        return answer
      } else if (config.apiProvider === "gemini" && this.geminiApiKey) {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`,
          {
            contents: [{
              parts: [{
                text: `${systemPrompt}\n\nQuestion: ${question}`
              }]
            }]
          },
          {
            headers: {
              "Content-Type": "application/json"
            }
          }
        )

        const answer = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No answer generated"
        console.log("Generated answer:", answer.substring(0, 100) + "...")
        return answer
      } else if (config.apiProvider === "anthropic" && this.anthropicClient) {
        const response = await this.anthropicClient.messages.create({
          model: model || "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: question
            }
          ]
        })

        const answer = response.content[0]?.type === "text" 
          ? response.content[0].text 
          : "No answer generated"
        console.log("Generated answer:", answer.substring(0, 100) + "...")
        return answer
      } else {
        throw new Error("No AI client available or API key not configured")
      }
    } catch (error) {
      console.error("Error generating reply:", error)
      throw error
    }
  }
}

