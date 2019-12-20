export async function updateSetting(settingsCol, setting, value) {
    await settingsCol.updateOne({'setting': { $eq: setting} },
        { $set: {'value': value} },
        { upsert: true });
}

export async function getSetting(settingsCol, setting) {
    return (await settingsCol.findOne({'setting': {$eq: setting} })).value;
}