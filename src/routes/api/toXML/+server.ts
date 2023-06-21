import { XMLBuilder } from 'fast-xml-parser';
import type { RequestEvent } from './$types';

export const POST = async (event: RequestEvent) => {
    const json = await event.request.json() as SaveFile;
    if (!json) return new Response("No file provided", { status: 400 });
    if (!json || typeof json !== 'object' || 'gameVersion'! in json) return new Response("Not valid save file", { status: 400 });

    // Get an array of player and farmhands
    // We have to apply a handful of changes to each of them, so it's easier to do it in a loop, rather than doing them separately
    const players = [json.SaveGame.player, ...json.SaveGame.locations.GameLocation.find((loc) => loc.name === "Farm")?.buildings?.Building.map((b) => b.indoors?.farmhand!).filter((f) => f) ?? []];


    // Undo type safety enhancements
    // 1. Inventory, switch undefined into <string xsi:nil="true" /> (for farmhands, too)
    // @ts-expect-error
    players.forEach((player) => player.items.Item = player.items.Item.map((item) => item === undefined ? { '@_xsi:nil': 'true' } : item));
    // 2. For some reason, if your character knows only 1 crafting or cooking recipe, it will be an object, not an array (we probably don't need to undo this)
    players.forEach((player) => {
        if (player.craftingRecipes?.item && Array.isArray(player.craftingRecipes.item)) {
            // @ts-expect-error
            player.craftingRecipes.item = player.craftingRecipes.item[0];
        }
        if (player.cookingRecipes?.item && Array.isArray(player.cookingRecipes.item)) {
            // @ts-expect-error
            player.cookingRecipes.item = json.SaveGame.player.cookingRecipes.item[0];
        }
    });

    const builder = new XMLBuilder({ attributeNamePrefix: '@_', ignoreAttributes: false, suppressUnpairedNode: false, suppressEmptyNode: true, suppressBooleanAttributes: false });
    const raw = builder.build(json) as string;
    const xml = raw
        .split('------WebKitFormBoundary')[0]
        .trim()
        .replaceAll('&apos;', '\'')
        .replaceAll('/>', ' />');
    const blob = new Blob([xml], { type: 'text/text' });

    return new Response(blob);
};