import os
import time
from typing import NotRequired, TypedDict
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate

load_dotenv()

class GraphState(TypedDict):
    initial_prompt: str
    processed_data: str
    status: str
    duration_ms: NotRequired[int]
    input_text: NotRequired[str]
    output_text: NotRequired[str]
    error: NotRequired[str]
    retry_count: NotRequired[int]

# FIX: Swapped to the active 3.1 model!
llm = ChatGroq(
    temperature=0.7, 
    model_name="llama-3.1-8b-instant",
    api_key=os.environ.get("GROQ_API_KEY")
)

# NEW: Pass the system_prompt into the factory
def create_llm_node(node_label: str, system_prompt: str):
    def llm_node(state: GraphState):
        started_at = time.perf_counter()
        current_data = state.get("processed_data", "")
        prompt = state.get("initial_prompt", "")
        input_text = current_data if current_data else prompt
        
        # Inject the custom UI instructions into the template
        template = f"""
        You are an AI agent named "{node_label}". 
        Your specific instructions: {system_prompt}
        
        Process the input and pass it along. Keep your response concise (1-2 sentences).
        
        Input: {{text}}
        """
        
        prompt_template = PromptTemplate.from_template(template)
        chain = prompt_template | llm

        max_attempts = 2
        last_error = ""

        for attempt in range(max_attempts):
            try:
                print(f"Running LLM for node: {node_label}... attempt {attempt + 1}")
                response = chain.invoke({"text": input_text})
                duration_ms = int((time.perf_counter() - started_at) * 1000)

                new_data = f"{current_data}\n\n[{node_label}]: {response.content}" if current_data else f"[{node_label}]: {response.content}"

                return {
                    "processed_data": new_data,
                    "status": f"Successfully processed by {node_label}",
                    "duration_ms": duration_ms,
                    "input_text": input_text,
                    "output_text": response.content,
                    "retry_count": attempt,
                }
            except Exception as exc:
                last_error = str(exc)
                if attempt < max_attempts - 1:
                    time.sleep(0.5)

        duration_ms = int((time.perf_counter() - started_at) * 1000)
        error_output = f"[{node_label} failed]: {last_error}"

        return {
            "processed_data": current_data,
            "status": f"Failed to process {node_label}",
            "duration_ms": duration_ms,
            "input_text": input_text,
            "output_text": error_output,
            "error": last_error,
            "retry_count": max_attempts - 1,
        }
    return llm_node
