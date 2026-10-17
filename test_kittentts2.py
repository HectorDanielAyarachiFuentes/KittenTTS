import time
import soundfile as sf
from kittenml import KittenTTS

print("Cargando KittenTTS 2 (weights='emb4', decoder='student_w4', device='cpu')...")
t0 = time.time()
m = KittenTTS("KittenML/kitten-tts-2", weights="emb4", decoder="student_w4", device="cpu")
print(f"Modelo cargado en {time.time() - t0:.2f}s")

voices = m.available_voices
print(f"Total de voces disponibles: {len(voices)}")
print(f"Algunas voces: {voices[:15]}")

text_es = "Hola, esto es una prueba del repositorio KittenTTS pasando texto a voz."
voice_to_use = "Spanish" if "Spanish" in voices else "Bruno"
print(f"Generando audio con voz '{voice_to_use}': \"{text_es}\"")
t1 = time.time()
audio = m.generate(text_es, voice=voice_to_use, normalize=False)
gen_time = time.time() - t1
audio_len = len(audio) / m.sample_rate

sf.write("prueba_espanol.wav", audio, m.sample_rate)
print(f"¡Éxito! Generados {audio_len:.2f}s de audio en {gen_time:.2f}s (RTF: {gen_time/audio_len:.2f}x).")
print("Archivo guardado en prueba_espanol.wav")
