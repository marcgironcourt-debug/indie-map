# Stockage de l’agent Scout

## Fichiers conservés dans Git

- Le code de l’agent et de ses outils.
- Le corpus final actif `catalogue-site-learning-corpus.v2.json`.
- Les retours éditoriaux dans `prospect-feedback.v1.json`.
- L’historique anti-répétition dans `prospect-history.v1.json`.
- Les critères, décisions et petits artefacts éditoriaux durables.

## Fichiers conservés uniquement en local

- Les fichiers `*.cache.v1.json`.
- Le cache d’embeddings.
- Les profils et fusions intermédiaires.
- Les anciens corpus remplacés par une version plus récente.
- Les clusters et sorties d’expérimentation régénérables.
- Les journaux de test.

## Règle durable

Ne jamais forcer tout `data/private/scout` dans Git.

Ajouter individuellement uniquement les sources de vérité nécessaires
au fonctionnement de l’agent. Retirer un fichier de Git avec
`git rm --cached` ne doit jamais supprimer sa copie locale.
