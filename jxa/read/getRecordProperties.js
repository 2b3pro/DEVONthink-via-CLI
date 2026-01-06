#!/usr/bin/env osascript -l JavaScript
// Get all properties of a DEVONthink record
// Usage: osascript -l JavaScript getRecordProperties.js <uuid>

ObjC.import("Foundation");

function getProperty(record, propName, isFunction = true) {
  try {
    let value = isFunction ? record[propName]() : record[propName];
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  } catch (e) {
    return `Error getting property ${propName}: ${e.message}`;
  }
}

const uuidArg = getArg(4, null);

if (!uuidArg) {
  JSON.stringify({ success: false, error: "Usage: getRecordProperties.js <uuid>" });
} else {
  const app = Application("DEVONthink");
  const uuid = extractUuid(uuidArg);
  const record = app.getRecordWithUuid(uuid);

  if (!record) {
    JSON.stringify({ success: false, error: "Record not found: " + uuid });
  } else {
    const props = {
      success: true,
      // Identity
      id: getProperty(record, 'id'),
      uuid: getProperty(record, 'uuid'),
      name: getProperty(record, 'name'),
      filename: getProperty(record, 'filename'),
      
      // Location
      path: getProperty(record, 'path'),
      location: getProperty(record, 'location'),
      database: getProperty(record, 'database') ? record.database().name() : 'N/A',
      
      // Type & Content Info
      recordType: getProperty(record, 'recordType'),
      kind: getProperty(record, 'kind'),
      mimeType: getProperty(record, 'mimeType'),
      
      // Dates
      creationDate: getProperty(record, 'creationDate'),
      modificationDate: getProperty(record, 'modificationDate'),
      additionDate: getProperty(record, 'additionDate'),
      openingDate: getProperty(record, 'openingDate'),
      
      // Size & Metrics
      size: getProperty(record, 'size'),
      wordCount: getProperty(record, 'wordCount'),
      characterCount: getProperty(record, 'characterCount'),
      pageCount: getProperty(record, 'pageCount'),
      duration: getProperty(record, 'duration'),
      width: getProperty(record, 'width'),
      height: getProperty(record, 'height'),
      dpi: getProperty(record, 'dpi'),
      
      // Metadata
      tags: getProperty(record, 'tags'),
      comment: getProperty(record, 'comment'),
      url: getProperty(record, 'url'),
      aliases: getProperty(record, 'aliases'),
      rating: getProperty(record, 'rating'),
      label: getProperty(record, 'label'),
      
      // Flags & State
      flag: getProperty(record, 'flag'),
      unread: getProperty(record, 'unread'),
      locked: getProperty(record, 'locking'),
      indexed: getProperty(record, 'indexed'),
      pending: getProperty(record, 'pending'),
      encrypted: getProperty(record, 'encrypted'),
      score: getProperty(record, 'score'),
      state: getProperty(record, 'state'),
      
      // Exclusions
      excludeFromSearch: getProperty(record, 'excludeFromSearch'),
      excludeFromClassification: getProperty(record, 'excludeFromClassification'),
      excludeFromSeeAlso: getProperty(record, 'excludeFromSeeAlso'),
      excludeFromTagging: getProperty(record, 'excludeFromTagging'),
      excludeFromWikiLinking: getProperty(record, 'excludeFromWikiLinking'),
      excludeFromChat: getProperty(record, 'excludeFromChat'),

      // Counts
      numberOfDuplicates: getProperty(record, 'numberOfDuplicates'),
      numberOfReplicants: getProperty(record, 'numberOfReplicants'),
      annotationCount: getProperty(record, 'annotationCount'),
      attachmentCount: getProperty(record, 'attachmentCount')
    };

    // Optional properties
    props.latitude = getProperty(record, 'latitude');
    props.longitude = getProperty(record, 'longitude');
    props.altitude = getProperty(record, 'altitude');
    props.batesNumber = getProperty(record, 'batesNumber');
    props.doi = getProperty(record, 'digitalObjectIdentifier');
    props.isbn = getProperty(record, 'isbn');

    JSON.stringify(props, null, 2);
  }
}