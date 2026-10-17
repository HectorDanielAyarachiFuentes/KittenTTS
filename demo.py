"""
Demo interactivo o por línea de comandos para KittenTTS en Windows.
Permite sintetizar texto a voz tanto con:
1) Modelo ligero ONNX (rápido, ideal para CPU estándar)
2) Modelo completo KittenTTS 2 (con soporte de 20 idiomas, emociones y clonación)
"""

import sys
import argparse
import soundfile as sf
from kittenml import KittenTTS

def run_tts(text: str, model_type: str = "onnx", voice: str = None, output_file: str = "resultado.wav"):
    print(f"=== Sintetizando Texto a Voz con KittenTTS ({model_type.upper()}) ===")
    print(f"Texto: \"{text}\"")
    
    if model_type.lower() == "onnx":
        # Modelo ligero (80M parámetros) ejecutado en CPU con ONNX Runtime
        model_name = "KittenML/kitten-tts-mini-0.8"
        print(f"Cargando {model_name}...")
        m = KittenTTS(model_name)
        selected_voice = voice or "Bruno"
        print(f"Voces disponibles: {m.available_voices}")
        print(f"Usando voz: {selected_voice}")
        audio = m.generate(text, voice=selected_voice)
        sample_rate = 24000
    else:
        # Modelo KittenTTS 2 (1.7B parámetros)
        model_name = "KittenML/kitten-tts-2"
        print(f"Cargando {model_name} (emb4 + student_w4)...")
        m = KittenTTS(model_name, weights="emb4", decoder="student_w4", device="cpu")
        selected_voice = voice or "Spanish"
        print(f"Usando voz: {selected_voice}")
        audio = m.generate(text, voice=selected_voice, normalize=False)
        sample_rate = m.sample_rate

    sf.write(output_file, audio, sample_rate)
    duration = len(audio) / sample_rate
    print(f"¡Listo! Audio guardado en '{output_file}' ({duration:.2f} segundos a {sample_rate} Hz).")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KittenTTS - Texto a Voz")
    parser.add_argument("--text", type=str, default="Hola, esto es una prueba de KittenTTS pasando texto a voz.", help="Texto a sintetizar")
    parser.add_argument("--model", type=str, choices=["onnx", "kitten2"], default="onnx", help="Tipo de modelo a usar ('onnx' es ultrarrápido, 'kitten2' es el modelo avanzado de 1.7B)")
    parser.add_argument("--voice", type=str, default=None, help="Voz a utilizar (ej. 'Bruno', 'Luna', 'Spanish')")
    parser.add_argument("--out", type=str, default="resultado.wav", help="Ruta del archivo de salida .wav")
    
    args = parser.parse_args()
    run_tts(args.text, args.model, args.voice, args.out)
