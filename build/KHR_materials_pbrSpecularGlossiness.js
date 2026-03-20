import {
	CanvasTexture,
	Color,
	LinearFilter,
	MathUtils,
	Matrix3,
	Matrix4,
	SRGBColorSpace,
	Uniform,
	Vector2,
	Vector3,
	Vector4,
	DataTexture,
	RGBAFormat,
	FloatType,
	RepeatWrapping,
	NearestFilter,
	MeshPhysicalMaterial
} from 'three';

/**
 * KHR_materials_pbrSpecularGlossiness extension
 * https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness
 *
 * The specular-glossiness material is a PBR material that uses specular and
 * glossiness factors instead of metallic and roughness. This extension allows
 * glTF to import such materials.
 *
 * This extension converts the specular-glossiness material to a
 * MeshPhysicalMaterial (with metallic and roughness) to allow using the same
 * rendering path in engines that only support metallic-roughness.
 *
 * Reference: https://github.com/mrdoob/three.js/blob/dev/examples/jsm/loaders/KHR_materials_pbrSpecularGlossiness.js
 */

class KHR_materials_pbrSpecularGlossiness {

	constructor( parser ) {

		this.parser = parser;

	}

	getMaterialType( materialIndex ) {

		const parser = this.parser;
		const materialDef = parser.json.materials[ materialIndex ];

		if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;

		return MeshPhysicalMaterial;

	}

	extendMaterialParams( materialIndex, materialParams ) {

		const parser = this.parser;
		const materialDef = parser.json.materials[ materialIndex ];
		const extension = materialDef.extensions[ this.name ];

		const pending = [];

		// Specular
		if ( extension.diffuseFactor !== undefined ) {

			materialParams.color = new Color().fromArray( extension.diffuseFactor );

		}

		if ( extension.diffuseTexture !== undefined ) {

			pending.push( parser.assignTexture( materialParams, 'map', extension.diffuseTexture ) );

		}

		if ( extension.specularFactor !== undefined ) {

			// three.js uses roughness for metallic roughness materials,
			// but when converting to metallic-roughness we need to set roughness to 1 - glossiness.
			// However, the specular-glossiness model uses specular factor as the F0 (reflectivity at normal incidence).
			// We can convert to metallic-roughness by setting metalness to 0 and using specular as the base color.
			// But the conversion is not perfect. We'll do a best effort.
			// For simplicity, we set emissive to black and metalness to 0.
			// Then we set roughness to 1 - glossiness (if glossiness is provided).
			// If glossiness is not provided, default to 1.
			// specularFactor is not directly used in three.js metallic-roughness, but we can use it as emissive? No.

			// Actually, the correct conversion (simplified) is:
			// - diffuse = baseColor
			// - specular = F0 (reflectivity)
			// - glossiness = 1 - roughness
			// So we set:
			materialParams.metalness = 0.0;
			// Use specularFactor to influence the baseColor? Not exactly.
			// We'll set emissive to black and metalness to 0.
			// The specularFactor is ignored because we can't map it directly.
			// For a better conversion, you'd need to compute a metallic-roughness material that approximates the same reflectance.

			// This is a simplified approach that just uses diffuse as color and sets roughness from glossiness.
			// If you need exact conversion, you may want to use a different material or a shader.

		}

		if ( extension.specularGlossinessTexture !== undefined ) {

			// This texture contains specular (RGB) and glossiness (A)
			pending.push( parser.assignTexture( materialParams, 'specularMap', extension.specularGlossinessTexture ) );

		}

		if ( extension.glossinessFactor !== undefined ) {

			// Convert glossiness (0-1) to roughness (0-1) where glossiness=1 => roughness=0, glossiness=0 => roughness=1
			materialParams.roughness = 1.0 - extension.glossinessFactor;

		}

		return Promise.all( pending );

	}

}

KHR_materials_pbrSpecularGlossiness.prototype.name = 'KHR_materials_pbrSpecularGlossiness';

export { KHR_materials_pbrSpecularGlossiness };