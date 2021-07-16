/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module html-support/htmlcomment
 */

import { Plugin } from 'ckeditor5/src/core';
import { CKEditorError, uid } from 'ckeditor5/src/utils';

/**
 * The HTML comment feature.
 *
 * For a detailed overview, check the {@glink features/html-comment HTML comment feature documentation}.
 *
 * @extends module:core/plugin~Plugin
 */
export default class HtmlComment extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'HtmlComment';
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;

		// Convert the `$comment` view element to `$comment:<unique id>` marker and store its content (the comment itself) as a $root
		// attribute. The comment content is needed in the `dataDowncast` pipeline to re-create the comment node.
		editor.conversion.for( 'upcast' ).elementToMarker( {
			view: '$comment',
			model: ( viewElement, { writer } ) => {
				const commentContent = viewElement.getCustomProperty( '$rawContent' );
				const root = editor.model.document.getRoot();
				const markerName = `$comment:${ uid() }`;

				writer.setAttribute( markerName, commentContent, root );

				return markerName;
			}
		} );

		// Convert the `$comment` marker to `$comment` UI element with `$rawContent` custom property containing the comment content.
		editor.conversion.for( 'dataDowncast' ).markerToElement( {
			model: '$comment',
			view: ( modelElement, { writer } ) => {
				const root = editor.model.document.getRoot();
				const markerName = modelElement.markerName;
				const commentContent = root.getAttribute( markerName );

				const comment = writer.createUIElement( '$comment' );

				writer.setCustomProperty( '$rawContent', commentContent, comment );

				return comment;
			}
		} );

		// Remove comments' markers and their corresponding $root attributes, which are no longer present.
		editor.model.document.registerPostFixer( writer => {
			const root = editor.model.document.getRoot();

			const changedMarkers = editor.model.document.differ.getChangedMarkers();

			const changedCommentMarkers = changedMarkers.filter( marker => {
				return marker.name.startsWith( '$comment' );
			} );

			const removedCommentMarkers = changedCommentMarkers.filter( marker => {
				const newRange = marker.data.newRange;

				return newRange && newRange.root.rootName === '$graveyard';
			} );

			if ( removedCommentMarkers.length === 0 ) {
				return false;
			}

			for ( const marker of removedCommentMarkers ) {
				writer.removeMarker( marker.name );
				writer.removeAttribute( marker.name, root );
			}

			return true;
		} );
	}

	/**
	 * Creates an HTML comment on the specified position and returns its marker.
	 *
	 * *Note*: If two comments are created at the same position, the second comment will be inserted before the first one.
	 *
	 * @param {module:engine/model/position~Position} position
	 * @param {String} content
	 *
	 * @returns {String} Comment ID. This ID can be later used to e.g. remove the comment from the content.
	 */
	createHtmlComment( position, content ) {
		const id = uid();
		const editor = this.editor;
		const model = editor.model;
		const root = model.document.getRoot();
		const markerName = `$comment:${ id }`;

		return model.change( writer => {
			const range = writer.createRange( position );

			writer.addMarker( markerName, {
				usingOperation: true,
				affectsData: true,
				range
			} );

			writer.setAttribute( markerName, content, root );

			return markerName;
		} );
	}

	/**
	 * Removes an HTML comment with the given comment ID.
	 *
	 * It throws an error if the comment with the given ID does not exist.
	 * Note that a comment can be removed also by removing the content in which it is created.
	 *
	 * @param {String} commentID The ID of the comment to be removed.
	 */
	removeHtmlComment( commentID ) {
		const editor = this.editor;
		const root = editor.model.document.getRoot();

		const markerName = `$comment:${ commentID }`;
		const marker = editor.model.markers.get( markerName );

		if ( !marker ) {
			/**
			 * An HTML comment with the given ID does not exist.
			 *
			 * @error html-comment-does-not-exist
			 */
			throw new CKEditorError( 'html-comment-does-not-exist', null );
		}

		editor.model.change( writer => {
			writer.removeMarker( marker );
			writer.removeAttribute( markerName, root );
		} );
	}

	/**
	 * Gets the HTML comment with the given ID.
	 *
	 * Returns `null` if the comment does not exist.
	 *
	 * @param {String} commentID
	 * @returns {null}
	 */
	getHtmlComment( commentID ) {
		const editor = this.editor;
		const marker = editor.model.markers.get( commentID );
		const root = editor.model.document.getRoot();

		if ( !marker ) {
			return null;
		}

		return {
			content: root.getAttribute( commentID ),
			position: marker.getStart()
		};
	}

	updateHtmlComment( commentID, { position, content } ) {
		const editor = this.editor;
		const marker = editor.model.markers.get( commentID );
		const root = editor.model.document.getRoot();

		if ( !marker ) {
			throw new CKEditorError( 'html-comment-does-not-exist', null );
		}

		editor.model.change( writer => {
			if ( position ) {
				const range = writer.createRange( position );

				writer.updateMarker( marker, { range } );
			}

			if ( content ) {
				writer.setAttribute( commentID, content, root );
			}
		} );
	}

	getHtmlCommentsAtPosition( position ) {
		const intersectingMarkers = Array.from( this.editor.model.markers.getMarkersAtPosition( position ) );

		return intersectingMarkers
			.filter( marker => marker.name.startsWith( '$comment:' ) )
			.map( commentMarker => commentMarker.name );
	}
}
