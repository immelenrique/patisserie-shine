// src/app/api/admin/delete-product/route.js
// La suppression d'un produit effaçait son historique (mouvements, dépenses) avec les droits du serveur.
// Elle est remplacée par l'archivage (fonction archiver_produit, appelée depuis l'écran Stock principal) :
// le produit disparaît des listes et son historique est conservé.
import { NextResponse } from 'next/server'

export async function DELETE() {
  return NextResponse.json(
    { error: 'La suppression de produit est remplacée par l\'archivage : l\'historique est conservé.' },
    { status: 410 }
  )
}
