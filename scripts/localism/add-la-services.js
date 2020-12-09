require('dotenv').config();

const contentful = require("contentful-management");
const { richTextFromMarkdown } = require("@contentful/rich-text-from-markdown");

const MAX_TO_IMPORT = 100000;

/**
 * Load the Data
 */
const lwa = require("./data-3-lwa");
const councilHousing = require("./data-4-council-housing");
const homelessness = require("./data-5-homelessness");
const dhp = require("./data-6-dhp");
const councils = require('./data-councils')

const client = contentful.createClient({
  space: process.env.space_id,
  accessToken: process.env.access_token,
  environment: process.env.space_env
});

async function createWebLink(environment, name, title, URL) {
  const entry = await environment.createEntry("topicExternalLink", {
    fields: {
      name: {
        "en-GB": name,
      },
      title: {
        "en-GB": title,
      },
      newTab: {
        "en-GB": false,
      },
      URL: {
        "en-GB": URL,
      },
    },
  });

  await entry.publish()
  return entry
}

async function createContactPoint(environment, data) {
  const {
    internalTitle,
    councilId,
    serviceType,
    phone,
    oooPhone,
    address,
    email,
    webLinkId,
    richText,
    documentDownload,
  } = data;

  try {
  const entry = await environment.createEntry("dataContactPoint", {
    fields: {
      internalTitle: {
        "en-GB": internalTitle,
      },
      localAuthority: {
        "en-GB": {
          sys: {
            type: "Link",
            linkType: "Entry",
            id: councilId,
          },
        },
      },
      serviceType: {
        "en-GB": serviceType,
      },
      phone: {
        "en-GB": phone,
      },
      oooPhone: {
        "en-GB": oooPhone,
      },
      address: {
        "en-GB": address,
      },
      email: email && email.length > 0 ? {
        "en-GB": email,
      } : null,
      link: webLinkId
        ? {
            "en-GB": {
              sys: {
                type: "Link",
                linkType: "Entry",
                id: webLinkId,
              },
            },
          }
        : {},
      text: {
        "en-GB": richText ? richText : null,
      },
      documentDownload: documentDownload
        ? {
            "en-GB": {
              sys: { id: documentDownload, linkType: "Asset", type: "Link" },
            },
          }
        : {},
    },
  });
  await entry.publish()
  console.log(`Created contact point: ${internalTitle}`)
  return entry
  } catch (e) {
    console.error(e)
  }
}

async function createUpload(environment, name, filename, url) {
  try {

    let ext = filename.substr(filename.lastIndexOf('.') + 1);
    dt = 'application/pdf'
    switch(ext) {
      case 'doc':
        dt = 'application/msword'
        break
      case 'docx':
        dt = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        break
    }

    const asset = await environment.createAsset({
      fields: {
        title: {
          "en-GB": name,
        },
        file: {
          "en-GB": {
            contentType: dt,
            fileName: filename,
            upload: url,
          },
        },
      },
    });
    await asset.processForAllLocales();

    // https://github.com/contentful/contentful-management.js/issues/101
    // Re-get the asset, as this call sometimes fails
    const toPublish = await environment.getAsset(asset.sys.id)
    await toPublish.publish();
    console.log(`Uploaded, processed and published asset ${name}`);
    return toPublish;
  } catch (e) {
    console.error("Error uploading asset", e);
    return null;
  }
}

async function createLocalAuthority(environment, title, shortCode, authorityType) {
  const entry = await environment.createEntry("dataLocalAuthority", {
    fields: {
      title: {
        "en-GB": title,
      },
      shortCode: {
        "en-GB": shortCode,
      },
      authorityType: {
        "en-GB": authorityType,
      },
    },
  });
  entry.publish();
  return entry
}

async function processCouncils(environment) {
  let councilMap = [];
  for (const c of councils.slice(0, MAX_TO_IMPORT ? MAX_TO_IMPORT : councils.length)) {
    try {
      const res = await createLocalAuthority(environment, c.title, c.shortCode, c.authorityType)
      console.log(`Created ${c.title}`, res.sys.id);
      councilMap.push({
        shortCode: c.shortCode,
        contentfulId: res.sys.id,
        title: c.title,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
    } catch (e) {
      console.error(e);
    }
  }
  console.log(`Created ${councilMap.length} Councils`);
  return councilMap
}

async function processDHP(environment, councilMap) {
  for (const d of dhp.slice(0, MAX_TO_IMPORT ? MAX_TO_IMPORT : dhp.length)) {
    try {
      const council = councilMap.find((c) => c.shortCode === d.shortCode);
      if (council) {
        let linkInContentful = null;
        if (d.webLink) {
          linkInContentful = await createWebLink(
            environment,
            `${council.title} DHP Service`,
            `${council.title} DHP Service`,
            d.webLink
          );
        }

        let assetDownload = null;
        if (d.documentDownload && d.documentDownload !== "/") {
          // Upload asset
          const docRes = await createUpload(
            environment,
            `${council.title} DHP Download`,
            d.documentDownload.replace("/", "_"),
            `https://tools.shelter.org.uk/tools/contact_details/downloads/${d.documentDownload}`
          );
          assetDownload = docRes;
        }

        const rt = await richTextFromMarkdown(d.text);
        await createContactPoint(environment, {
          internalTitle: `${council.title} DHP Service`,
          councilId: council.contentfulId,
          serviceType: "DHP",
          phone: d.phone,
          oooPhone: null,
          address: null,
          email: d.email,
          webLinkId: linkInContentful ? linkInContentful.sys.id : null,
          richText: rt ? rt : null,
          documentDownload: assetDownload ? assetDownload.sys.id : null,
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
      } else {
        console.warn(`Error creating DHP, no Council for for ${council.shortCode}`);
      }
    } catch (e) {
      console.error("Error creating DHP record", e);
    }
  }
}

async function processHomelessness(environment, councilMap) {
  for (const h of homelessness.slice(0, MAX_TO_IMPORT ? MAX_TO_IMPORT : homelessness.length)) {
    try {
      const council = councilMap.find((c) => c.shortCode === h.shortCode);
      if (council) {
        let linkInContentful = null;
        if (h.webLink) {
          linkInContentful = await createWebLink(
            environment,
            `${council.title} Homelessness Service`,
            `${council.title} Homelessness`,
            h.webLink
          );
        }

        const rt = await richTextFromMarkdown(h.text);

        await createContactPoint(environment, {
          internalTitle: `${council.title} Homelessness Service`,
          councilId: council.contentfulId,
          serviceType: "Homelessness",
          phone: h.phone,
          oooPhone: h.oooPhone,
          address: h.address,
          email: h.email,
          webLinkId: linkInContentful ? linkInContentful.sys.id : null,
          richText: rt,
          documentDownload: null,
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (e) {
      console.error(e);
    }
  }
}

async function processCouncilHousing(environment, councilMap) {
  for (const h of councilHousing.slice(0, MAX_TO_IMPORT ? MAX_TO_IMPORT : councilHousing.length)) {
    try {
      const council = councilMap.find((c) => c.shortCode === h.shortCode);
      if (council) {
        let linkInContentful = null;
        if (h.webLink) {
          linkInContentful = await createWebLink(
            environment,
            `${council.title} Council Housing Service`,
            `${council.title} Council Housing`,
            h.webLink
          );
        }

        const rt = await richTextFromMarkdown(h.text);

        let assetDownload = null;
        if (h.documentDownload && h.documentDownload !== "/") {
          // Upload asset
          const docRes = await createUpload(
            environment,
            `${council.title} Council Housing Download`,
            h.documentDownload.replace("/", "_"),
            `https://tools.shelter.org.uk/tools/contact_details/downloads/${d.documentDownload}`
          );
          assetDownload = docRes;
        }

        await createContactPoint(environment, {
          internalTitle: `${council.title} Council Housing Service`,
          councilId: council.contentfulId,
          serviceType: "Council Housing",
          phone: h.phone,
          address: h.address,
          email: h.email,
          webLinkId: linkInContentful ? linkInContentful.sys.id : null,
          richText: rt,
          documentDownload: assetDownload ? assetDownload.sys.id : null,
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (e) {
      console.error(e);
    }
  }
}

async function processLWA(environment, councilMap) {
  for (const h of lwa.slice(0, MAX_TO_IMPORT ? MAX_TO_IMPORT : lwa.length)) {
    try {
      const council = councilMap.find((c) => c.shortCode === h.shortCode);
      if (council) {
        let linkInContentful = null;
        if (h.webLink) {
          linkInContentful = await createWebLink(
            environment,
            `${council.title} LWA Service`,
            `${council.title} LWA`,
            h.webLink
          );
        }

        const rt = await richTextFromMarkdown(h.text);

        await createContactPoint(environment, {
          internalTitle: `${council.title} LWA`,
          councilId: council.contentfulId,
          serviceType: "LWA",
          phone: h.phone,
          address: h.address,
          email: h.email,
          webLinkId: linkInContentful ? linkInContentful.sys.id : null,
          richText: rt,
          documentDownload: null,
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (e) {
      console.error(e);
    }
  }
}

/**
 * Create all the entries
 */

client
  .getSpace(process.env.space_id)
  .then((space) => space.getEnvironment(process.env.space_env))
  .then(async (environment) => {


    const councilMap = await processCouncils(environment)

    await processDHP(environment, councilMap)
    await processHomelessness(environment, councilMap)
    await processCouncilHousing(environment, councilMap)
    await processLWA(environment, councilMap)
  })
  .then((entry) => console.log(entry))
  .catch(console.error);