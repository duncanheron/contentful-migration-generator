require("dotenv").config();
const contentful = require("contentful-management");

// Todo: source from env file
// Todo: add check/warning or interactive prompt if adding to master env
const SPACE_ID = "";
const EXPORT_FROM_ENV = "";
const IMPORT_TO_ENV = "";
const ACCESS_TOKEN = "";

const client = contentful.createClient({
  accessToken: ACCESS_TOKEN,
});

let taggedEntries;
let taggedAssets;
let linkedEntries = [];

const getTaggedContent = async (env) => {
  // Todo: get tags from from argvs
  // Get all tagged entries from source env
  taggedEntries = await env.getEntries({
    "metadata.tags.sys.id[in]": "rebrandPages",
  });

  // Get all tagged assets from source env
  taggedAssets = await env.getAssets({
    "metadata.tags.sys.id[in]": "rebrandMiscImages",
  });
};

const getReferencedContent = async (env) => {
  // Get all the referenced entries from the tagged entries
  for (const entry of taggedEntries.items) {
    const x = await env.getEntryReferences(entry.sys.id, {
      maxDepth: 4,
    });
    linkedEntries.push(x);
  }
};

const addEntries = async (env) => {
  // Check the top level tagged entries
  // eg homepage, support us page etc
  for (const taggedEntry of taggedEntries.items) {
    await bar(env, taggedEntry);
  }

  // Check the entries referenced by the tagged entries
  // eg hero banners, forms, hero banners
  for (const entry of linkedEntries) {
    for (const entryToAdd of entry.includes.Entry) {
      await bar(env, entryToAdd);
    }
  }
};

const addAssets = async (env) => {
  // Check the indivdually tagged assets
  // eg logos
  for (const taggedAsset of taggedAssets.items) {
    await foo(env, taggedAsset);
  }

  // Check the assets referenced by the linked entries
  // eg images in hero banner, content cards or page information components
  for (const asset of linkedEntries) {
    for (const assetToAdd of asset.includes.Asset) {
      await foo(env, assetToAdd);
    }
  }
};

const bar = async (env, entryToAdd) => {
  try {
    const entryTarget = await env.getEntry(entryToAdd.sys.id);

    console.log(
      `Entry already exists, checking for updates of ${entryToAdd.sys.id}`
    );

    if (entryToAdd.sys.publishedAt > entryTarget.sys.publishedAt) {
      console.log(`Entry needs updating`);
      entryTarget.fields = entryToAdd.fields;
      await entryTarget.update();

      console.log(`Entry updated`);
    } else {
      console.log(`No updates to this entry needed`);
    }
  } catch (e) {
    if (e.name === "NotFound") {
      console.log(`Entry not found, adding ${entryToAdd.sys.id}`);

      await env.createEntryWithId(
        entryToAdd.sys.contentType.sys.id,
        entryToAdd.sys.id,
        {
          fields: { ...entryToAdd.fields },
        }
      );

      console.log(`Entry created and ready for publishing`);
    } else {
      console.log(e);
    }
  }
};

const foo = async (env, assetToAdd) => {
  try {
    const assetTarget = await env.getAsset(assetToAdd.sys.id);

    console.log(
      `Asset already exists, checking for updates of ${assetToAdd.sys.id}`
    );
    if (assetToAdd.sys.publishedAt > assetTarget.sys.publishedAt) {
      console.log(`Asset needs updating`);
      assetTarget.fields = assetToAdd.fields;
      await assetTarget.update();

      const toPublish = await env.getAsset(assetToAdd.sys.id);
      await toPublish.publish();

      console.log(`Asset updated and published`);
    } else {
      console.log(`No updates to this asset needed`);
    }
  } catch (e) {
    if (e.name === "NotFound") {
      console.log(`Asset not found, creating ${assetToAdd.sys.id}`);

      await env.createAssetWithId(assetToAdd.sys.id, {
        fields: { ...assetToAdd.fields },
      });

      const toPublish = await env.getAsset(assetToAdd.sys.id);
      await toPublish.publish();

      console.log(`Uploaded, processed and published`);
    } else {
      console.log(e);
    }
  }
};

(async () => {
  const space = await client.getSpace(SPACE_ID);

  const fromEnvironment = await space.getEnvironment(EXPORT_FROM_ENV);
  await getTaggedContent(fromEnvironment);
  await getReferencedContent(fromEnvironment);

  const toEnvironment = await space.getEnvironment(IMPORT_TO_ENV);

  await addAssets(toEnvironment);
  await addEntries(toEnvironment);

  console.log("All done");
  console.log(
    `Now go to the Contentful env you have imported this content to (${IMPORT_TO_ENV} in ${SPACE_ID}) check the content created or and updated`
  );
})();
