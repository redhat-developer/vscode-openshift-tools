/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

// TODO: Figure out how to support two kinds of components everywhere:
// * configuration when map context to component data on disk
// * application tree
// * in commands

// TODO: recognize s2i and devfile components based on 'odo describe --context' output
// by sourceType is undefined

// TODO: let create devfile components only from workspace folders because other kind of components
// are not supported

// TODO: OdoModel.getObjectByContext should be async and relay on promise that is returned form
// addContexts method, because in case of big workspace loadContexts might be still working
// when user is already requesting info from OdoModel

// TODO: How to set ports for url created for devfile component

// TODO: Fix workflow for creating components based on git repository

// TODO: Filter out folders with s2i and devfile components when selecting context for new component

// TODO: Ban the linking for Devfile Components