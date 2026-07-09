from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "informe_final.md"
OUT_DIR = ROOT / "output" / "pdf"
TEX_FILE = OUT_DIR / "informe_final_researchflow.tex"
PDF_FILE = OUT_DIR / "informe_final_researchflow.pdf"


def esc(text: str) -> str:
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(replacements.get(ch, ch) for ch in text)


def flush_list(lines, out, list_type):
    if list_type:
        out.append(r"\end{%s}" % list_type)
    return None


def convert_markdown(md: str) -> str:
    out = []
    in_code = False
    code_lines = []
    list_type = None
    table_lines = []

    def flush_table():
        nonlocal table_lines
        if table_lines:
            rows = []
            for row in table_lines:
                cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
                if all(set(cell) <= {"-", ":", " "} for cell in cells):
                    continue
                rows.append(cells)
            if rows:
                headers = rows[0]
                out.append(r"\begin{itemize}")
                for row in rows[1:]:
                    if len(row) == 2:
                        out.append(r"\item \textbf{%s}: %s" % (esc(row[0]), esc(row[1])))
                    else:
                        pairs = []
                        for index, value in enumerate(row):
                            label = headers[index] if index < len(headers) else f"Campo {index + 1}"
                            pairs.append(r"\textbf{%s}: %s" % (esc(label), esc(value)))
                        out.append(r"\item %s" % ("; ".join(pairs)))
                out.append(r"\end{itemize}")
            table_lines = []

    for raw in md.splitlines():
        line = raw.rstrip()

        if line.startswith("```"):
            flush_table()
            if in_code:
                out.append(r"\begin{verbatim}")
                out.extend(code_lines)
                out.append(r"\end{verbatim}")
                code_lines = []
                in_code = False
            else:
                list_type = flush_list(line, out, list_type)
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        if line.startswith("|"):
            list_type = flush_list(line, out, list_type)
            table_lines.append(line)
            continue
        flush_table()

        if not line.strip():
            list_type = flush_list(line, out, list_type)
            out.append("")
            continue

        if line.startswith("# "):
            list_type = flush_list(line, out, list_type)
            out.append(r"\phantomsection")
            out.append(r"\section*{%s}" % esc(line[2:].strip()))
            out.append(r"\addcontentsline{toc}{section}{%s}" % esc(line[2:].strip()))
        elif line.startswith("## "):
            list_type = flush_list(line, out, list_type)
            title = line[3:].strip()
            out.append(r"\phantomsection")
            out.append(r"\section*{%s}" % esc(title))
            out.append(r"\addcontentsline{toc}{section}{%s}" % esc(title))
        elif line.startswith("### "):
            list_type = flush_list(line, out, list_type)
            title = line[4:].strip()
            out.append(r"\phantomsection")
            out.append(r"\subsection*{%s}" % esc(title))
            out.append(r"\addcontentsline{toc}{subsection}{%s}" % esc(title))
        elif re.match(r"^\d+\. ", line):
            if list_type != "enumerate":
                list_type = flush_list(line, out, list_type)
                out.append(r"\begin{enumerate}")
                list_type = "enumerate"
            item = re.sub(r"^\d+\. ", "", line)
            out.append(r"\item %s" % esc(item))
        elif line.startswith("- "):
            if list_type != "itemize":
                list_type = flush_list(line, out, list_type)
                out.append(r"\begin{itemize}")
                list_type = "itemize"
            out.append(r"\item %s" % esc(line[2:].strip()))
        else:
            list_type = flush_list(line, out, list_type)
            text = re.sub(r"\*\*(.*?)\*\*", r"\\textbf{\1}", esc(line))
            out.append(text + r"\par")

    if in_code:
        out.append(r"\begin{verbatim}")
        out.extend(code_lines)
        out.append(r"\end{verbatim}")
    flush_table()
    flush_list("", out, list_type)
    return "\n".join(out)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    body = convert_markdown(SOURCE.read_text(encoding="utf-8"))
    tex = rf"""\documentclass[11pt,a4paper]{{article}}
\usepackage[utf8]{{inputenc}}
\usepackage[T1]{{fontenc}}
\usepackage{{geometry}}
\usepackage{{hyperref}}
\usepackage{{parskip}}
\geometry{{margin=2.2cm}}
\hypersetup{{colorlinks=true, linkcolor=black, urlcolor=blue}}
\title{{ResearchFlow - Asistente automatizado de investigacion profunda con n8n}}
\author{{Daniel Cueto}}
\date{{3 de julio de 2026}}
\begin{{document}}
\maketitle
\tableofcontents
\newpage
{body}
\end{{document}}
"""
    TEX_FILE.write_text(tex, encoding="utf-8")
    for _ in range(2):
        subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", TEX_FILE.name],
            cwd=OUT_DIR,
            check=True,
        )
    # Limpiar intermedios de LaTeX; en el repo solo debe quedar el PDF.
    for ext in (".aux", ".log", ".out", ".toc", ".tex"):
        OUT_DIR.joinpath(PDF_FILE.stem + ext).unlink(missing_ok=True)
    print(PDF_FILE)


if __name__ == "__main__":
    main()
