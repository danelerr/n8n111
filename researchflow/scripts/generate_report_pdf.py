from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).with_name("informe_researchflow.tex")
OUT_DIR = ROOT / "output" / "pdf"
JOB_NAME = "informe_researchflow"
PDF_FILE = OUT_DIR / f"{JOB_NAME}.pdf"


def main() -> None:
    if shutil.which("xelatex") is None:
        raise RuntimeError("Se necesita xelatex para regenerar el informe final")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    command = [
        "xelatex",
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-file-line-error",
        f"-output-directory={OUT_DIR}",
        f"-jobname={JOB_NAME}",
        str(SOURCE.relative_to(ROOT)),
    ]

    last_output = ""
    # Tres pasadas estabilizan indice, referencias y tablas de varias paginas.
    for _ in range(3):
        completed = subprocess.run(
            command,
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        last_output = completed.stdout
        if completed.returncode != 0:
            print(last_output)
            completed.check_returncode()

    for extension in (".aux", ".log", ".out", ".toc"):
        OUT_DIR.joinpath(JOB_NAME + extension).unlink(missing_ok=True)

    overfull_count = last_output.count("Overfull \\hbox")
    if overfull_count:
        print(f"Advertencia: LaTeX reporto {overfull_count} lineas demasiado anchas")

    print(PDF_FILE)


if __name__ == "__main__":
    main()
