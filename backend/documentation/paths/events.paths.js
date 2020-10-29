const eventsPath = {
    'root': {
        get: {
            tags: ['Events'],
            description: 'Get all events or search based on event key',
            operationId: 'findAllEvents',
            parameters: [
                {
                    name: 'search',
                    in: 'query',
                    schema: {
                        $ref: '#/components/schemas/key'
                    },
                    required: false
                },

                {
                    name: 'sort_by',
                    in: 'query',
                    schema: {
                        type: 'string'
                    },
                    required: false

                },

                {
                    name: 'order',
                    in: 'query',
                    schema: {
                        type: 'string'
                    },
                    required: false
                }

            ],

            responses: {
                '200': {
                    description: 'Event(s) were found in the database',
                    content: {
                        'application/json': {
                            schema: {
                                    $ref: '#/components/schemas/Events'
                            }
                        }
                    }
                },
                '400': {
                    description: 'No events found in the database',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                message: 'No events found in database',
                                internalCode: 'no_events_found'
                            }
                        }
                    }
                },
                '500': {
                    description: 'Error loading sample data into database',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                message: 'Error searching for events in database',
                                internalCode: 'event_search_error'
                            }
                        }
                    }
                }
            }
        }
    },
    'load': {
        put: {
            tags: ['Events'],
            description: 'Load sample event data from file into database',
            operationId: 'loadEvents',
            parameters: [],
            responses: {
                '200': {
                    description: 'Event sample data was successfully loaded into the database',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: {
                                        type: 'string'
                                    }
                                }
                            }
                        }
                    }
                },
                '500': {
                    description: 'Error loading sample data into database',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            }
                        }
                    }
                }
            }
        }
    },
    findEventsForSerial: {
        get: {
            tags: ['Events'],
            description: 'Find the events associated with an asset by serial number',
            operationId: 'findEventsForSerial',
            parameters: [{
                name: 'serial',
                in: 'path',
                schema: {
                    $ref: '#/components/schemas/serial'
                },
                required: true
            }],
            responses: {
                '200': {
                    description: 'All related events associated with the serial number provided',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#components/schemas/Events'
                            }
                        }
                    }
                },
                '400': {
                    description: 'Missing parameters',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                message: 'serial is missing',
                                internalCode: 'missing_parameters'
                            }
                        }
                    }
                },
                '500': {
                    description: 'No matching events found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                message: 'No events found for serial',
                                internalCode: 'no_events_found'
                            }
                        }
                    }
                }
            }
        }
    },

    order: {
        get: {
            tags: ['Events'],
            description: 'Order search results in asc or desc order specified by user',
            operationId: 'order',
            parameters: [{
                name: 'order',
                in: 'path',
                schema: {
                    type: 'string'
                },
                required: true
            }],
            responses: {
                '200': {
                    description: 'Successfully specified asc or desc sort order',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#components/schemas/Events'
                            }
                        }
                    }
                },
                '400': {
                    description: 'Incorrect parameters: enter asc or desc',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                message: 'order type is missing',
                                internalCode: 'missing_parameters'
                            }
                        }
                    }
                },
                '500': {
                    description: 'No matching events found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                message: 'No events found',
                                internalCode: 'no_events_found'
                            }
                        }
                    }
                }
            }
        }
    },

    sort_by: {
        get: {
            tags: ['Events'],
            description: 'sort events by the provided sort type',
            operationId: 'findEventsForSerial',
            parameters: [{
                name: 'serial',
                in: 'path',
                schema: {
                    $ref: '#/components/schemas/serial'
                },
                required: true
            }],
            responses: {
                '200': {
                    description: 'All related events associated with the serial number provided',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#components/schemas/Events'
                            }
                        }
                    }
                },
                '400': {
                    description: 'Missing parameters',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                message: 'serial is missing',
                                internalCode: 'missing_parameters'
                            }
                        }
                    }
                },
                '500': {
                    description: 'No matching events found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                message: 'No events found for serial',
                                internalCode: 'no_events_found'
                            }
                        }
                    }
                }
            }
        }
    }
}

module.exports = eventsPath;
