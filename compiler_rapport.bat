@echo off
REM Script de compilation du rapport LaTeX
REM Prerequis: MiKTeX ou TeX Live installe

echo [1/2] Premiere passe pdflatex...
pdflatex -interaction=nonstopmode rapport_technique.tex

echo [2/2] Deuxieme passe (pour la table des matieres)...
pdflatex -interaction=nonstopmode rapport_technique.tex

echo.
echo Compilation terminee ! Fichier : rapport_technique.pdf
pause
