#!/usr/bin/env python3
"""
Servidor local ultraliviano para PsicoTurnos (Consultorio de Psicología)
Ejecuta la app y abre el navegador web automáticamente.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Log simplificado
        sys.stderr.write(f"[PsicoTurnos] {self.address_string()} - {format%args}\n")

def main():
    os.chdir(DIRECTORY)
    
    # Intentar iniciar en el puerto 3000 o buscar uno libre
    port = PORT
    server = None
    for attempt in range(5):
        try:
            server = socketserver.TCPServer(("", port), Handler)
            break
        except OSError:
            port += 1

    if not server:
        print(f"No se pudo iniciar el servidor en los puertos {PORT}-{port}. Abriendo archivo directo...")
        webbrowser.open(os.path.join(DIRECTORY, "index.html"))
        return

    url = f"http://localhost:{port}"
    print("=" * 60)
    print(f"🌿 PsicoTurnos - Consultorio de Psicología Activo")
    print(f"📍 Accede en tu navegador: {url}")
    print(f"Para cerrar el servidor presiona Ctrl+C en esta ventana.")
    print("=" * 60)

    # Abrir navegador automáticamente
    webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido. ¡Hasta pronto!")
        server.server_close()

if __name__ == '__main__':
    main()
