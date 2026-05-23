import os
from typing import TypedDict
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate

# Load API keys from .env
load_dotenv()

class GraphState(TypedDict):
    initial_prompt: str
    processed_data: str
    status: str

# Initialize the Groq LLM (Using LLaMA 3 8B because it's insanely fast)
llm = ChatGroq(
    temperature=0.7, 
    model_name="llama3-8b-8192",
    api_key=os.environ.get("GROQ_API_KEY")
)

def create_llm_node(node_label: str):
    def llm_node(state: GraphState):
        current_data = state.get("processed_data", "")
        prompt = state.get("initial_prompt", "")
        
        # If this is the first node, use the initial prompt. Otherwise, use the previous node's output.
        input_text = current_data if current_data else prompt
        
        # Create a dynamic prompt based on the node's label
        template = f"""
        You are an AI agent named "{node_label}". 
        Your task is to process the following input, add your own unique insight, and pass it along.
        Keep your response concise (1-2 sentences).
        
        Input: {{text}}
        """
        
        prompt_template = PromptTemplate.from_template(template)
        chain = prompt_template | llm
        
        print(f"Running LLM for node: {node_label}...")
        
        # Execute the real AI call!
        response = chain.invoke({"text": input_text})
        
        # Append the new AI response to the running data log
        new_data = f"{current_data}\n\n[{node_label}]: {response.content}" if current_data else f"[{node_label}]: {response.content}"
        
        return {
            "processed_data": new_data,
            "status": f"Successfully processed by {node_label}"
        }
    return llm_node