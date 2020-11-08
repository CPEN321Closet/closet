require('dotenv').config();
const { getCalendarEvents } = require('./calendar-service');
const { getWeatherInfo } = require('./weather-service');
const { timestampToDate } = require('../utils/time-helper');
const { hashCode, randomInt } = require('../utils/hash');
const LOG = require('../utils/logger');

const Clothes = require('../model/clothes');
const Outfit = require('../model/outfit');

const FORMAL_KEYWORDS = [
  'conference',
  'interview',
  'meeting',
  'presentation',
  'speech',
];

const COLOURS = [
  'Red',
  'Orange',
  'Yellow',
  'Blue',
  'Green',
  'Purple',
  'Pink',
  'Grey',
  'White',
  'Black',
];

/**
 * Entry point for complex logic
 *
 * @param {String} userId
 */
const generateOutfit = async req => {
  const userId = req.userData.userId;
  let AllOutfits = [];
  let TodayFormalOutfits = [];
  let TodayFormalEvents = [];
  let AllClothes = []; // Array of Clothes object
  let TodayWhether = {};

  // Return all clothes in database
  const getAllClothes = async () => {
    try {
      AllClothes = await Clothes.find({ user: userId });
    } catch (exception) {
      LOG.error(exception.message);
    }
  };

  // Return all outfits in the database
  const getAllOutfits = async () => {
    try {
      AllOutfits = await Outfit.find({ user: userId });
    } catch (exception) {
      LOG.error(exception.message);
    }
  };

  // Return formal outfits generated today
  const getTodayFormalOutfits = async () => {
    const today = new Date()
      .toLocaleString('sv', { timeZoneName: 'short' })
      .substr(0, 10);

    TodayFormalOutfits = AllOutfits.filter(
      outfit =>
        outfit.created.toISOString().substr(0, 10) === today &&
        outfit.occasions.includes('formal')
    );
  };

  // Return today's formal events
  const getTodayFormalEvents = async () => {
    const time = timestampToDate(Date.now());
    const date = `${time.month.monthDesc}-${time.date}-${time.year}`;

    let response;
    try {
      response = await getCalendarEvents(date);
    } catch (exception) {
      LOG.error(exception.message);
      return;
    }

    const { events } = response;

    events.forEach(e => {
      const keyword = e.summary.toLowerCase().split(' ');
      for (const word of keyword) {
        if (FORMAL_KEYWORDS.includes(word)) {
          TodayFormalEvents.push(e.summary);
          break;
        }
      }
    });
  };

  // Return today's weather information
  const getTodayWeather = async () => {
    // Hard code place for now (using vancouver)

    let response;
    try {
      response = await getWeatherInfo('vancouver');
    } catch (exception) {
      LOG.error(exception.message);
      return;
    }

    const { today } = response;
    const { temp, weather } = today;

    TodayWhether = { temperature: temp, weather: weather[0].description };
  };

  // Save the outfit into database
  const saveOutfit = async result => {
    if (!result.success) {
      return {
        success: result.success,
        message: 'Failed to generate an outfit',
      };
    }

    const {
      chosenUpperClothes,
      chosenTrousers,
      chosenShoes,
      occasions,
      seasons,
      warning,
    } = result;

    const _id = hashCode(
      chosenUpperClothes.id + chosenTrousers.id + chosenShoes.id
    );

    let existingOutfits;
    try {
      existingOutfits = await Outfit.find({ _id: _id });
    } catch (exception) {
      LOG.error(exception.message);
      return {
        success: false,
        message: 'Failed to search outfit',
      };
    }

    // If the outfit has generated before, return it
    if (existingOutfits.length && existingOutfits[0] instanceof Outfit) {
      return {
        success: true,
        message: 'New outfit generated successfully!',
        warning,
        outfit: {
          id: existingOutfits[0].id,
          clothes: existingOutfits[0].clothes,
          created: existingOutfits[0].created,
          occasions,
          seasons,
          opinion: existingOutfits[0].opinion,
          user: userId,
          chosenUpperClothes,
          chosenTrousers,
          chosenShoes,
        },
      };
    }

    const newOutfit = new Outfit({
      _id,
      clothes: [chosenUpperClothes.id, chosenTrousers.id, chosenShoes.id],
      occasions,
      seasons,
      opinion: 'unknown',
      user: userId,
      created: new Date().setTime(
        new Date().getTime() - new Date().getTimezoneOffset() * 60 * 1000
      ),
    });

    try {
      await newOutfit.save();
    } catch (exception) {
      LOG.error(exception.message);
      return {
        success: false,
        message: 'Failed to save outfit',
      };
    }

    return {
      success: true,
      message: 'New outfit generated successfully!',
      warning,
      outfit: {
        _id: newOutfit._id,
        clothes: newOutfit.clothes,
        created: newOutfit.created,
        occasions,
        seasons,
        opinion: newOutfit.opinion,
        user: userId,
        chosenUpperClothes,
        chosenTrousers,
        chosenShoes,
      },
    };
  };

  // Create a formal outfit
  const createFormalOutfit = async () => {
    await getAllClothes();

    const allFormal = AllClothes.filter(c => c.occasions.includes('formal'));

    const formalOuterwear = allFormal.filter(c => c.category === 'outerwear');
    const formalShirt = allFormal.filter(c => c.category === 'shirt');
    const formalTrousers = allFormal.filter(c => c.category === 'trousers');
    const formalShoes = allFormal.filter(c => c.category === 'shoes');

    /**
     * Requirements to return a formal outfit
     * 1. have formal outerwear and formal shirt
     * 2. have formal trousers
     * 3. have formal shoes
     * if no formal outwear and no formal shirt
     */
    if (
      (!formalOuterwear.length && !formalShirt.length) ||
      !formalTrousers.length ||
      !formalShoes.length
    ) {
      let warning =
        'We notice you have these events today, but you do not have any formal clothes!\n';
      TodayFormalEvents.forEach(event => {
        warning += `${event}\n`;
      });

      // Generate a normal outfit instead
      const result = await createNormalOutfit();
      return {
        ...result,
        warning,
      };
    }

    let chosenUpperClothes, chosenTrousers, chosenShoes;

    if (!formalOuterwear.length) {
      // if we do not have any formal outerwear
      chosenUpperClothes = formalShirt[randomInt(formalShirt.length)];
    } else if (!formalShirt.length) {
      // if we do not have any formal shirts
      chosenUpperClothes = formalOuterwear[randomInt(formalOuterwear.length)];
    } else {
      // If we have both formal outerwear and formal shirt, choose one of them randomly
      chosenUpperClothes = randomInt(2)
        ? formalShirt[randomInt(formalShirt.length)]
        : formalOuterwear[randomInt(formalOuterwear.length)];
    }

    chosenTrousers = formalTrousers[randomInt(formalTrousers.length)];
    chosenShoes = formalShoes[randomInt(formalShoes.length)];

    /**
     * success: indication whether we can generate an outfit or not
     * chosenUpperClothes: upper clothes (outerwear or shirt) to include
     * chosenTrousers: trousers to include
     * chosenShoes: shoes to include
     * occasions: formal outfit,
     * seasons: all seasons,
     */
    return {
      success: true,
      chosenUpperClothes,
      chosenTrousers,
      chosenShoes,
      occasions: ['formal'],
      seasons: ['All'],
    };
  };

  // Create a normal outfit
  const createNormalOutfit = async () => {
    await getAllClothes();

    const allNormal = AllClothes.filter(c => !c.occasions.includes('formal'));

    let normalOuterwear = allNormal.filter(c => c.category === 'outerwear');
    let normalShirt = allNormal.filter(c => c.category === 'shirt');
    let normalTrousers = allNormal.filter(c => c.category === 'trousers');
    let normalShoes = allNormal.filter(c => c.category === 'shoes');

    // Must have the follow three
    // 1. outerwear OR shirt
    // 2. trousers
    // 3. shoe

    if (
      (!normalOuterwear.length && !normalShirt.length) ||
      !normalTrousers.length ||
      !normalShoes.length
    ) {
      return {
        success: false,
        message: 'Add more clothes to get outfit!',
      };
    }

    // TODO: need better weather implementation!

    // get weather & season tag
    // await getTodayWeather();

    // const { temperature, description } = todayWhether;
    // let season = getSeasonFromTemperature(temperature);

    let currSeason = getSeasonNorth();

    // filter out other seasons
    normalOuterwear = normalOuterwear.filter(
      c => c.seasons.includes(currSeason) || c.seasons.includes('All')
    );
    normalShirt = normalShirt.filter(
      c => c.seasons.includes(currSeason) || c.seasons.includes('All')
    );
    normalShoes = normalShoes.filter(
      c => c.seasons.includes(currSeason) || c.seasons.includes('All')
    );
    normalTrousers = normalTrousers.filter(
      c => c.seasons.includes(currSeason) || c.seasons.includes('All')
    );

    // check if outfit exists
    let allOutfitIds = await (await Outfit.find({ user: userId })).map(
      outfit => outfit._id
    );

    // loop through all current clothing
    // TODO: these loops looks bad bad bad --- look into cartesian product
    // https://stackoverflow.com/questions/12303989/cartesian-product-of-multiple-arrays-in-javascript

    const outfitWithShirt = cartesian(normalShirt, normalTrousers, normalShoes);
    const outfitWithOutwear = cartesian(
      normalOuterwear,
      normalTrousers,
      normalShoes
    );

    let chosenUpperClothes, chosenTrousers, chosenShoes;
    for (const outerwear of normalOuterwear) {
      for (const shirt of normalShirt) {
        for (const trousers of normalTrousers) {
          for (const shoes of normalShoes) {
            let random = randomInt(2);

            let outfitId = random
              ? hashCode(shirt.id + trousers.id + shoes.id)
              : hashCode(outerwear.id + trousers.id + shoes.id);

            // if this outfit does not already exist
            if (!allOutfitIds.includes(outfitId)) {
              chosenUpperClothes = random ? shirt : outerwear;
              chosenTrousers = trousers;
              chosenShoes = shoes;
              break;
            }
          }
        }
      }
    }

    // TODO (M8): return error if run out of clothes

    return {
      success: true,
      chosenUpperClothes,
      chosenTrousers,
      chosenShoes,
      occasions: ['normal'], // TODO: what about occasion?
      seasons: [currSeason],
    };
  };

  /**
   * Preparation and setup
   * Initialize the following things
   * 1. all outfits in database
   * 2. formal outfits generated today
   * 3. today's formal events
   */
  try {
    await getAllOutfits();
    await getTodayFormalOutfits();
    await getTodayFormalEvents();
  } catch (exception) {
    LOG.error(exception.message);
    return {
      success: false,
      message: 'Failed to initialize',
      warning: exception.message,
    };
  }

  let result;
  if (!TodayFormalOutfits.length && TodayFormalEvents.length) {
    // Case 1: no formal outfits and have formal events => create a formal outfit
    result = await createFormalOutfit();
  } else if (!TodayFormalOutfits.length && !TodayFormalEvents.length) {
    // Case 2: no formal outfits and/but no formal events => create a normal outfit
    result = await createNormalOutfit();
  } else {
    // Case 3: have formal outfit but no formal event => create a normal outfit
    result = await createNormalOutfit();
  }

  const outfit = await saveOutfit(result);
  return outfit;
};

/**
 * Get Northern hemisphere season
 * @returns one of ['Winter', 'Spring', 'Summer', 'Fall']
 */
const getSeasonNorth = () =>
  ['Winter', 'Spring', 'Summer', 'Fall'][
    Math.floor((new Date().getMonth() / 12) * 4) % 4
  ];

/**
 * Get season from temperature
 * @param {int} temperature
 * @return {String} Season "Spring" "Summer" "Fall" "Winter"
 */
const getSeasonFromTemperature = temperature => {
  if (temperature > 20) return 'Summer';
  if (temperature <= 20 && temperature >= 15) return 'Fall';
  if (temperature < 15 && temperature >= 10) return 'Spring';
  if (temperature > 10) return 'Winter';
};

/**
 * https://stackoverflow.com/questions/12303989/cartesian-product-of-multiple-arrays-in-javascript
 * @param  {...any} a Array
 */
const cartesian = (...a) =>
  a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));

module.exports = {
  generateOutfit,
};